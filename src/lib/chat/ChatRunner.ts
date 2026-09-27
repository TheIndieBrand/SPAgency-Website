import type { DiscordUser } from "../discord";
import { listAccessibleGuilds } from "../dashboard-guard";
import type { GuildConfig } from "../db/GuildConfigRepository";
import { json } from "../session";
import { listOpenTickets } from "../support-bot";
import { renderMessageHtml } from "../support-format";
import { chatRepository } from "./ChatRepository";
import { ConsentVersion, ContextChunks, HistoryMessages, MaxInputChars, chatConfigured } from "./config";
import { ASK_GUILD_TEXT, dashboardAssistantService, type GuildRef } from "./DashboardAssistantService";
import { llmClient } from "./LlmClient";
import { knowledgeBase } from "./KnowledgeBase";
import { SettingsToolName, buildMessages, messageChars } from "./prompt";
import { redactSecrets } from "./redact";
import { parseTicketDraft } from "./ticket";
import { estimateUsage, recordUsage, usageState, type TokenUsage } from "./usage";
import { chatRateLimiter } from "./ChatRateLimiter";

const MAX_TICKET_NOTE = 500;
const DEFAULT_SETTINGS_TEXT = "Te he preparado estos cambios. Revísalos y confírmalos si son lo que querías:";
const DEFAULT_TICKET_TEXT = "No he encontrado la respuesta. Puedo abrir un ticket para que el equipo te ayude; revisa el resumen y confírmalo:";
const COMMAND_TICKET_TEXT = "Te he preparado este ticket con lo que hemos hablado. Revisa el resumen y confírmalo:";

/**
 * runs one chat turn and the /ticket command: validates the request,
 * retrieves context, streams the model's answer and stores the result.
 *
 * a chat turn's response to the browser is an sse stream with these events:
 *   meta      { conversationId }
 *   html      { html }            → accumulated text, already formatted and sanitized
 *   proposal  { id, kind, subject, summary }
 *   done      { usage }
 *   error     { message }
 */
export class ChatRunner {
	/** user ids with a generation currently in progress. */
	private readonly active = new Set<string>();

	/** checks shared by the chat turn and the commands that spend tokens. */
	private guardBase(user: DiscordUser): Response | null {
		if (!chatConfigured()) {
			return json({ error: "not_configured", message: "El asistente no está disponible ahora mismo." }, 503);
		}
		if (!chatRepository.hasConsent(user.id, ConsentVersion)) {
			return json({ error: "consent_required", message: "Acepta el aviso para usar el asistente." }, 403);
		}
		return null;
	}

	/** daily quota, per-minute rate limit, and one generation at a time. */
	private guardBudget(user: DiscordUser): Response | null {
		const usage = usageState(user.id);
		if (usage.remaining <= 0) {
			return json(
				{
					error: "limit_reached",
					message: "Has llegado al límite de uso de hoy. Se restablece a medianoche (hora de Madrid); si es urgente, abre un ticket.",
					usage,
				},
				429,
			);
		}
		if (!chatRateLimiter.withinRate(user.id)) {
			return json({ error: "rate_limited", message: "Vas muy rápido. Espera unos segundos." }, 429);
		}
		if (this.active.has(user.id)) {
			return json({ error: "busy", message: "Espera a que termine la respuesta anterior." }, 429);
		}
		return null;
	}

	/**
	 * runs one chat turn: streams the model's answer over sse and stores the
	 * conversation, usage and any proposal it produced.
	 * @param input - the user, their access token, the conversation and message, and an abort signal.
	 * @returns the sse response stream.
	 */
	chatTurn(input: { user: DiscordUser; accessToken: string; conversationId?: string; message: string; signal: AbortSignal }): Response {
		const { user, signal } = input;
		const message = input.message.trim();

		const denied = this.guardBase(user);
		if (denied) return denied;
		if (!message || message.length > MaxInputChars) {
			return json({ error: "invalid_body", message: `Escribe un mensaje de hasta ${MaxInputChars} caracteres.` }, 400);
		}
		const blocked = this.guardBudget(user);
		if (blocked) return blocked;

		let conversationId = input.conversationId;
		if (conversationId) {
			// someone else's conversation is treated as if it doesn't exist.
			if (chatRepository.getConversation(conversationId)?.userId !== user.id) {
				return json({ error: "not_found", message: "Esa conversación no existe." }, 404);
			}
		} else {
			const title = message.replace(/\s+/g, " ").slice(0, 60);
			conversationId = chatRepository.createConversation(user.id, user.global_name || user.username, title);
		}

		const conversation = conversationId;
		this.active.add(user.id);

		const abort = new AbortController();
		signal.addEventListener("abort", () => abort.abort());
		const encoder = new TextEncoder();
		let open = true;

		const stream = new ReadableStream<Uint8Array>({
			start: async (controller) => {
				const send = (event: string, data: unknown) => {
					if (open) controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
				};

				let text = "";
				let usage: TokenUsage | null = null;
				let toolArguments: string | null = null;
				let settingsArguments: string | null = null;
				let promptChars = 0;
				// the guild and config that settings changes can be proposed against.
				const ctx: { target: { guild: GuildRef; config: GuildConfig } | null; reason: "none" | "multiple" | "unavailable" } = { target: null, reason: "none" };
				const findTarget = async () => {
					if (ctx.target) return ctx.target;
					const selection = await dashboardAssistantService.resolveGuild(input.accessToken, conversation);
					if (!selection.ok) {
						ctx.reason = selection.reason;
						return null;
					}
					const config = await dashboardAssistantService.loadConfigFor(selection.guild);
					if (!config) ctx.reason = "unavailable";
					else ctx.target = { guild: selection.guild, config };
					return ctx.target;
				};

				try {
					send("meta", { conversationId: conversation });

					// what's stored and sent is the message with any obvious secrets masked.
					const question = redactSecrets(message);
					const history = chatRepository.recentTurns(conversation, HistoryMessages);
					chatRepository.addMessage({ conversationId: conversation, role: "user", content: question });

					// a very short message ("what about on mobile?") is searched together
					// with the user's previous one, which is what gives it meaning.
					const lastUser = [...history].reverse().find((m) => m.role === "user")?.content ?? "";
					const hits = knowledgeBase.search(question.length < 40 ? `${lastUser} ${question}` : question, ContextChunks);

					// guild settings are only sent if the message talks about settings.
					let settingsBlock = "";
					if (dashboardAssistantService.wantsSettings(question.length < 40 ? `${lastUser} ${question}` : question)) {
						const found = await findTarget();

						// several guilds and none chosen in this conversation: never guessed nor
						// sent to the model (doesn't spend quota). the user is asked which one,
						// with buttons, and the client repeats the request once they choose.
						// "how do I" questions are answered from the docs without asking for a guild.
						if (!found && ctx.reason === "multiple" && !dashboardAssistantService.isHowTo(question)) {
							const list = (await listAccessibleGuilds(input.accessToken).catch(() => null)) ?? [];
							chatRepository.addMessage({ conversationId: conversation, role: "assistant", content: ASK_GUILD_TEXT });
							send("html", { html: renderMessageHtml(ASK_GUILD_TEXT) });
							send("servers", { guilds: list.map((g) => ({ id: g.id, name: g.name })), retry: question });
							send("done", { usage: usageState(user.id) });
							return;
						}

						if (found) send("guild", { id: found.guild.id, name: found.guild.name });
						settingsBlock = found ? dashboardAssistantService.settingsContext(found.guild, found.config) : dashboardAssistantService.noGuildContext(ctx.reason);
					}

					const messages = buildMessages(history, question, hits, settingsBlock);
					promptChars = messageChars(messages);

					let lastSent = 0;
					const sendHtml = () => {
						lastSent = Date.now();
						send("html", { html: renderMessageHtml(text) });
					};

					for await (const event of llmClient.streamCompletion(messages, abort.signal)) {
						if (event.type === "text") {
							text += event.delta;
							if (Date.now() - lastSent > 60) sendHtml();
						} else {
							usage = event.usage;
							if (event.toolCall?.name === "offer_ticket") toolArguments = event.toolCall.arguments;
							if (event.toolCall?.name === SettingsToolName) settingsArguments = event.toolCall.arguments;
						}
					}

					const draft = toolArguments ? parseTicketDraft(toolArguments) : null;

					// changes the model proposed: validated and stored as a proposal; nothing
					// is applied until the user confirms.
					let settings: ReturnType<typeof dashboardAssistantService.buildSettingsProposal> | null = null;
					if (settingsArguments) {
						let changes: unknown = null;
						try {
							changes = (JSON.parse(settingsArguments) as { changes?: unknown }).changes;
						} catch {
							changes = null;
						}
						const found = await findTarget();
						settings = found
							? dashboardAssistantService.buildSettingsProposal(found.guild, found.config, changes)
							: { problems: [ctx.reason === "multiple" ? "Elige primero el servidor con /servidor." : "No he podido acceder a la configuración de tu servidor."] };
						const list = settings.problems.map((p) => `- ${p}`).join("\n");
						if (!settings.payload) {
							text = `${text.trim() ? `${text.trim()}\n\n` : ""}No he preparado ningún cambio:\n\n${list || "- No he entendido qué cambiar."}`;
						} else if (list) {
							// a valid proposal, but something requested got left out: say so.
							text = `${text.trim() || DEFAULT_SETTINGS_TEXT}\n\nNo he incluido:\n\n${list}`;
						}
					}

					if (!text.trim() && !draft && !settings?.payload) throw new Error("empty_completion");

					let proposal: { id: string; kind: "ticket" | "settings"; guild?: string; subject: string; summary: string } | null = null;
					if (settings?.payload) {
						const { subject, summary, payload } = settings;
						// always states where it would be applied, regardless of what the model wrote.
						text = `${text.trim() || DEFAULT_SETTINGS_TEXT}\n\nServidor: **${payload.guildName.replace(/[<>*_`]/g, "")}**`;
						const id = chatRepository.createProposal({ conversationId: conversation, userId: user.id, kind: "settings", subject, summary, payload });
						proposal = { id, kind: "settings", guild: payload.guildName, subject, summary };
					} else if (draft) {
						if (!text.trim()) text = DEFAULT_TICKET_TEXT;
						const id = chatRepository.createProposal({ conversationId: conversation, userId: user.id, ...draft });
						proposal = { id, kind: "ticket", ...draft };
					}

					const units = recordUsage(user.id, usage ?? estimateUsage(promptChars, text.length));
					chatRepository.addMessage({ conversationId: conversation, role: "assistant", content: text, units, proposalId: proposal?.id ?? null });

					sendHtml();
					if (proposal) send("proposal", proposal);
					send("done", { usage: usageState(user.id) });
				} catch (error) {
					const aborted = abort.signal.aborted;
					// if it was cut off mid-stream, what was generated so far is kept and
					// charged (the estimate goes by length, since the provider never got to report).
					if (text.trim()) {
						const units = recordUsage(user.id, usage ?? estimateUsage(promptChars, text.length));
						chatRepository.addMessage({ conversationId: conversation, role: "assistant", content: text, units });
					}
					if (!aborted) {
						console.error("[chat] model call failed:", error instanceof Error ? error.message : error);
						send("error", { message: "El asistente no ha podido responder. Inténtalo de nuevo en un momento." });
					}
				} finally {
					this.active.delete(user.id);
					if (open) controller.close();
					open = false;
				}
			},
			cancel: () => {
				open = false;
				abort.abort();
			},
		});

		return new Response(stream, {
			headers: {
				"Content-Type": "text/event-stream; charset=utf-8",
				// no cache, no transform (compression), so every event goes out immediately.
				"Cache-Control": "no-cache, no-transform",
				"X-Accel-Buffering": "no",
			},
		});
	}

	/**
	 * runs the /ticket [description] command: the model drafts a subject and
	 * summary from the conversation (and the description, if given), and a
	 * proposal is returned that the user confirms like any other. this spends
	 * tokens, so it goes through the same checks as a message; opening the
	 * ticket itself doesn't (that's the web).
	 * @param input - the user, the conversation, the note and an abort signal.
	 * @returns the drafted ticket proposal, or why it could not be drafted.
	 */
	async ticketCommand(input: { user: DiscordUser; conversationId?: string; note: string; signal: AbortSignal }): Promise<Response> {
		const { user } = input;
		const note = redactSecrets(input.note.trim()).slice(0, MAX_TICKET_NOTE);

		const denied = this.guardBase(user);
		if (denied) return denied;

		if (input.conversationId && chatRepository.getConversation(input.conversationId)?.userId !== user.id) {
			return json({ error: "not_found", message: "Esa conversación no existe." }, 404);
		}
		const history = input.conversationId ? chatRepository.recentTurns(input.conversationId, HistoryMessages) : [];
		if (!history.length && !note) {
			return json(
				{ error: "nothing_to_report", message: "Cuéntame primero qué necesitas, o escribe /ticket seguido de una descripción." },
				400,
			);
		}

		// only one open ticket is allowed: if there's already one, this says so before spending anything.
		const open = await listOpenTickets(user.id);
		const existing = open.ok ? open.data.tickets[0] : undefined;
		if (existing) {
			return json(
				{
					error: "ticket_open",
					message: "Ya tienes un ticket abierto. Ciérralo antes de abrir otro.",
					ticketId: existing.ticketId,
					url: `/support/tickets/${encodeURIComponent(existing.ticketId)}`,
				},
				409,
			);
		}

		const blocked = this.guardBudget(user);
		if (blocked) return blocked;

		this.active.add(user.id);
		try {
			const { draft, usage } = await llmClient.draftTicket(history, note, input.signal);
			const units = recordUsage(user.id, usage);
			if (!draft) {
				return json({ error: "draft_failed", message: "No he podido redactar el ticket. Inténtalo de nuevo o abre uno desde Soporte." }, 502);
			}

			const conversationId =
				input.conversationId ?? chatRepository.createConversation(user.id, user.global_name || user.username, `Ticket: ${note}`.slice(0, 60));
			chatRepository.addMessage({ conversationId, role: "user", content: `/ticket${note ? ` ${note}` : ""}` });
			const proposalId = chatRepository.createProposal({ conversationId, userId: user.id, ...draft });
			chatRepository.addMessage({ conversationId, role: "assistant", content: COMMAND_TICKET_TEXT, units, proposalId });

			return json({
				conversationId,
				html: renderMessageHtml(COMMAND_TICKET_TEXT),
				proposal: { id: proposalId, ...draft },
				usage: usageState(user.id),
			});
		} catch (error) {
			console.error("[chat] ticket draft failed:", error instanceof Error ? error.message : error);
			return json({ error: "draft_failed", message: "No he podido redactar el ticket. Inténtalo de nuevo en un momento." }, 502);
		} finally {
			this.active.delete(user.id);
		}
	}
}

export const chatRunner = new ChatRunner();
