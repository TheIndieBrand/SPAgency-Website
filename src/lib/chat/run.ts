import type { DiscordUser } from "../discord";
import { json } from "../session";
import { listOpenTickets } from "../support-bot";
import { renderMessageHtml } from "../support-format";
import {
	CONSENT_VERSION,
	CONTEXT_CHUNKS,
	HISTORY_MESSAGES,
	MAX_INPUT_CHARS,
	chatConfigured,
} from "./config";
import { addMessage, createConversation, createProposal, getConversation, hasConsent, recentTurns } from "./db";
import { listAccessibleGuilds } from "../dashboard-guard";
import { ASK_GUILD_TEXT, buildSettingsProposal, isHowTo, loadConfigFor, noGuildContext, resolveGuild, settingsContext, wantsSettings, type GuildRef } from "./dashboard";
import type { GuildConfig } from "../db/GuildConfigRepository";
import { draftTicket, streamCompletion } from "./llm";
import { search } from "./knowledge";
import { SETTINGS_TOOL_NAME, buildMessages, messageChars } from "./prompt";
import { redactSecrets } from "./redact";
import { parseTicketDraft } from "./ticket";
import { estimateUsage, recordUsage, usageState, type TokenUsage } from "./usage";
import { withinRate } from "./rate";

// Un turno del chat: valida, recupera contexto, llama al modelo en streaming y
// guarda el resultado. La respuesta al navegador es un flujo SSE con estos
// eventos:
//   meta      { conversationId }
//   html      { html }            → texto acumulado ya formateado y saneado
//   proposal  { id, kind, subject, summary }
//   done      { usage }
//   error     { message }

const active = new Set<string>(); // usuarios con una generación en curso

// Comprobaciones previas comunes al chat y a los comandos que gastan tokens.
function guardBase(user: DiscordUser): Response | null {
	if (!chatConfigured()) {
		return json({ error: "not_configured", message: "El asistente no está disponible ahora mismo." }, 503);
	}
	if (!hasConsent(user.id, CONSENT_VERSION)) {
		return json({ error: "consent_required", message: "Acepta el aviso para usar el asistente." }, 403);
	}
	return null;
}

// Cupo diario, límite por minuto y una generación a la vez.
function guardBudget(user: DiscordUser): Response | null {
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
	if (!withinRate(user.id)) {
		return json({ error: "rate_limited", message: "Vas muy rápido. Espera unos segundos." }, 429);
	}
	if (active.has(user.id)) {
		return json({ error: "busy", message: "Espera a que termine la respuesta anterior." }, 429);
	}
	return null;
}

const DEFAULT_SETTINGS_TEXT = "Te he preparado estos cambios. Revísalos y confírmalos si son lo que querías:";
const DEFAULT_TICKET_TEXT = "No he encontrado la respuesta. Puedo abrir un ticket para que el equipo te ayude; revisa el resumen y confírmalo:";

export function chatTurn(input: {
	user: DiscordUser;
	accessToken: string;
	conversationId?: string;
	message: string;
	signal: AbortSignal;
}): Response {
	const { user, signal } = input;
	const message = input.message.trim();

	const denied = guardBase(user);
	if (denied) return denied;
	if (!message || message.length > MAX_INPUT_CHARS) {
		return json({ error: "invalid_body", message: `Escribe un mensaje de hasta ${MAX_INPUT_CHARS} caracteres.` }, 400);
	}
	const blocked = guardBudget(user);
	if (blocked) return blocked;

	let conversationId = input.conversationId;
	if (conversationId) {
		// Una conversación ajena es como si no existiera.
		if (getConversation(conversationId)?.userId !== user.id) {
			return json({ error: "not_found", message: "Esa conversación no existe." }, 404);
		}
	} else {
		const title = message.replace(/\s+/g, " ").slice(0, 60);
		conversationId = createConversation(user.id, user.global_name || user.username, title);
	}

	const conversation = conversationId;
	active.add(user.id);

	const abort = new AbortController();
	signal.addEventListener("abort", () => abort.abort());
	const encoder = new TextEncoder();
	let open = true;

	const stream = new ReadableStream<Uint8Array>({
		async start(controller) {
			const send = (event: string, data: unknown) => {
				if (open) controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
			};

			let text = "";
			let usage: TokenUsage | null = null;
			let toolArguments: string | null = null;
			let settingsArguments: string | null = null;
			let promptChars = 0;
			// Servidor y configuración sobre los que se puede proponer cambios.
			const ctx: { target: { guild: GuildRef; config: GuildConfig } | null; reason: "none" | "multiple" | "unavailable" } = { target: null, reason: "none" };
			const findTarget = async () => {
				if (ctx.target) return ctx.target;
				const selection = await resolveGuild(input.accessToken, conversation);
				if (!selection.ok) {
					ctx.reason = selection.reason;
					return null;
				}
				const config = await loadConfigFor(selection.guild);
				if (!config) ctx.reason = "unavailable";
				else ctx.target = { guild: selection.guild, config };
				return ctx.target;
			};

			try {
				send("meta", { conversationId: conversation });

				// Lo que se guarda y se envía es el mensaje con los secretos evidentes
				// enmascarados.
				const question = redactSecrets(message);
				const history = recentTurns(conversation, HISTORY_MESSAGES);
				addMessage({ conversationId: conversation, role: "user", content: question });

				// Un mensaje muy corto ("¿y en móvil?") se busca junto con el anterior
				// del usuario, que es lo que le da sentido.
				const lastUser = [...history].reverse().find((m) => m.role === "user")?.content ?? "";
				const hits = search(question.length < 40 ? `${lastUser} ${question}` : question, CONTEXT_CHUNKS);

				// Los ajustes del servidor solo se mandan si el mensaje habla de ajustes.
				let settingsBlock = "";
				if (wantsSettings(question.length < 40 ? `${lastUser} ${question}` : question)) {
					const found = await findTarget();

					// Varios servidores y ninguno elegido en esta conversación: no se adivina ni se
					// llama al modelo (no gasta cupo). Se pregunta cuál, con botones, y el cliente
					// repite la petición cuando el usuario elige. Las preguntas de «cómo se hace» se
					// contestan con la documentación sin pedir servidor.
					if (!found && ctx.reason === "multiple" && !isHowTo(question)) {
						const list = (await listAccessibleGuilds(input.accessToken).catch(() => null)) ?? [];
						addMessage({ conversationId: conversation, role: "assistant", content: ASK_GUILD_TEXT });
						send("html", { html: renderMessageHtml(ASK_GUILD_TEXT) });
						send("servers", { guilds: list.map((g) => ({ id: g.id, name: g.name })), retry: question });
						send("done", { usage: usageState(user.id) });
						return;
					}

					if (found) send("guild", { id: found.guild.id, name: found.guild.name });
					settingsBlock = found ? settingsContext(found.guild, found.config) : noGuildContext(ctx.reason);
				}

				const messages = buildMessages(history, question, hits, settingsBlock);
				promptChars = messageChars(messages);

				let lastSent = 0;
				const sendHtml = () => {
					lastSent = Date.now();
					send("html", { html: renderMessageHtml(text) });
				};

				for await (const event of streamCompletion(messages, abort.signal)) {
					if (event.type === "text") {
						text += event.delta;
						if (Date.now() - lastSent > 60) sendHtml();
					} else {
						usage = event.usage;
						if (event.toolCall?.name === "offer_ticket") toolArguments = event.toolCall.arguments;
						if (event.toolCall?.name === SETTINGS_TOOL_NAME) settingsArguments = event.toolCall.arguments;
					}
				}

				const draft = toolArguments ? parseTicketDraft(toolArguments) : null;

				// Cambios propuestos por el modelo: se validan y se guardan como propuesta; no se
				// aplica nada hasta que el usuario confirme.
				let settings: ReturnType<typeof buildSettingsProposal> | null = null;
				if (settingsArguments) {
					let changes: unknown = null;
					try {
						changes = (JSON.parse(settingsArguments) as { changes?: unknown }).changes;
					} catch {
						changes = null;
					}
					const found = await findTarget();
					settings = found
						? buildSettingsProposal(found.guild, found.config, changes)
						: { problems: [ctx.reason === "multiple" ? "Elige primero el servidor con /servidor." : "No he podido acceder a la configuración de tu servidor."] };
					const list = settings.problems.map((p) => `- ${p}`).join("\n");
					if (!settings.payload) {
						text = `${text.trim() ? `${text.trim()}\n\n` : ""}No he preparado ningún cambio:\n\n${list || "- No he entendido qué cambiar."}`;
					} else if (list) {
						// Propuesta válida, pero algo de lo pedido se quedó fuera: se dice.
						text = `${text.trim() || DEFAULT_SETTINGS_TEXT}\n\nNo he incluido:\n\n${list}`;
					}
				}

				if (!text.trim() && !draft && !settings?.payload) throw new Error("empty_completion");

				let proposal: { id: string; kind: "ticket" | "settings"; guild?: string; subject: string; summary: string } | null = null;
				if (settings?.payload) {
					const { subject, summary, payload } = settings;
					// Se dice siempre dónde se aplicaría, con independencia de lo que escriba el modelo.
					text = `${text.trim() || DEFAULT_SETTINGS_TEXT}\n\nServidor: **${payload.guildName.replace(/[<>*_`]/g, "")}**`;
					const id = createProposal({ conversationId: conversation, userId: user.id, kind: "settings", subject, summary, payload });
					proposal = { id, kind: "settings", guild: payload.guildName, subject, summary };
				} else if (draft) {
					if (!text.trim()) text = DEFAULT_TICKET_TEXT;
					const id = createProposal({ conversationId: conversation, userId: user.id, ...draft });
					proposal = { id, kind: "ticket", ...draft };
				}

				const units = recordUsage(user.id, usage ?? estimateUsage(promptChars, text.length));
				addMessage({ conversationId: conversation, role: "assistant", content: text, units, proposalId: proposal?.id ?? null });

				sendHtml();
				if (proposal) send("proposal", proposal);
				send("done", { usage: usageState(user.id) });
			} catch (error) {
				const aborted = abort.signal.aborted;
				// Si se cortó a medias, lo generado hasta ahora se conserva y se cobra
				// (la estimación va por longitud, porque el proveedor no llegó a informar).
				if (text.trim()) {
					const units = recordUsage(user.id, usage ?? estimateUsage(promptChars, text.length));
					addMessage({ conversationId: conversation, role: "assistant", content: text, units });
				}
				if (!aborted) {
					console.error("[chat] fallo del modelo:", error instanceof Error ? error.message : error);
					send("error", { message: "El asistente no ha podido responder. Inténtalo de nuevo en un momento." });
				}
			} finally {
				active.delete(user.id);
				if (open) controller.close();
				open = false;
			}
		},
		cancel() {
			open = false;
			abort.abort();
		},
	});

	return new Response(stream, {
		headers: {
			"Content-Type": "text/event-stream; charset=utf-8",
			// Sin caché ni transformación (compresión) para que cada evento salga en el acto.
			"Cache-Control": "no-cache, no-transform",
			"X-Accel-Buffering": "no",
		},
	});
}

// ── /ticket ─────────────────────────────────────────────────────────────────

const MAX_TICKET_NOTE = 500;
const COMMAND_TICKET_TEXT = "Te he preparado este ticket con lo que hemos hablado. Revisa el resumen y confírmalo:";

// Comando /ticket [descripción]: la IA redacta asunto y resumen a partir de la
// conversación (y de la descripción, si la hay) y se devuelve una propuesta que el
// usuario confirma como cualquier otra. Gasta tokens, así que pasa por las mismas
// comprobaciones que un mensaje; lo que no gasta es abrir el ticket (eso es la web).
export async function ticketCommand(input: {
	user: DiscordUser;
	conversationId?: string;
	note: string;
	signal: AbortSignal;
}): Promise<Response> {
	const { user } = input;
	const note = redactSecrets(input.note.trim()).slice(0, MAX_TICKET_NOTE);

	const denied = guardBase(user);
	if (denied) return denied;

	if (input.conversationId && getConversation(input.conversationId)?.userId !== user.id) {
		return json({ error: "not_found", message: "Esa conversación no existe." }, 404);
	}
	const history = input.conversationId ? recentTurns(input.conversationId, HISTORY_MESSAGES) : [];
	if (!history.length && !note) {
		return json(
			{ error: "nothing_to_report", message: "Cuéntame primero qué necesitas, o escribe /ticket seguido de una descripción." },
			400,
		);
	}

	// Solo se permite un ticket abierto: si ya hay uno, se avisa antes de gastar nada.
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

	const blocked = guardBudget(user);
	if (blocked) return blocked;

	active.add(user.id);
	try {
		const { draft, usage } = await draftTicket(history, note, input.signal);
		const units = recordUsage(user.id, usage);
		if (!draft) {
			return json({ error: "draft_failed", message: "No he podido redactar el ticket. Inténtalo de nuevo o abre uno desde Soporte." }, 502);
		}

		const conversationId =
			input.conversationId ?? createConversation(user.id, user.global_name || user.username, `Ticket: ${note}`.slice(0, 60));
		addMessage({ conversationId, role: "user", content: `/ticket${note ? ` ${note}` : ""}` });
		const proposalId = createProposal({ conversationId, userId: user.id, ...draft });
		addMessage({ conversationId, role: "assistant", content: COMMAND_TICKET_TEXT, units, proposalId });

		return json({
			conversationId,
			html: renderMessageHtml(COMMAND_TICKET_TEXT),
			proposal: { id: proposalId, ...draft },
			usage: usageState(user.id),
		});
	} catch (error) {
		console.error("[chat] fallo al redactar el ticket:", error instanceof Error ? error.message : error);
		return json({ error: "draft_failed", message: "No he podido redactar el ticket. Inténtalo de nuevo en un momento." }, 502);
	} finally {
		active.delete(user.id);
	}
}
