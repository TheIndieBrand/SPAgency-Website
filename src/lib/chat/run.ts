import type { DiscordUser } from "../discord";
import { json } from "../session";
import { listOpenTickets } from "../support-bot";
import { renderMessageHtml } from "../support-format";
import {
	CONSENT_VERSION,
	CONTEXT_CHUNKS,
	HISTORY_MESSAGES,
	MAX_INPUT_CHARS,
	RATE_PER_MINUTE,
	chatConfigured,
} from "./config";
import { addMessage, createConversation, createProposal, getConversation, hasConsent, recentTurns } from "./db";
import { draftTicket, streamCompletion } from "./llm";
import { search } from "./knowledge";
import { buildMessages, messageChars } from "./prompt";
import { redactSecrets } from "./redact";
import { parseTicketDraft } from "./ticket";
import { estimateUsage, recordUsage, usageState, type TokenUsage } from "./usage";

// Un turno del chat: valida, recupera contexto, llama al modelo en streaming y
// guarda el resultado. La respuesta al navegador es un flujo SSE con estos
// eventos:
//   meta      { conversationId }
//   html      { html }            → texto acumulado ya formateado y saneado
//   proposal  { id, subject, summary }
//   done      { usage }
//   error     { message }

const active = new Set<string>(); // usuarios con una generación en curso
const recent = new Map<string, number[]>(); // marcas de tiempo por usuario (límite por minuto)

function withinRate(userId: string): boolean {
	const cutoff = Date.now() - 60_000;
	const stamps = (recent.get(userId) ?? []).filter((t) => t > cutoff);
	if (stamps.length >= RATE_PER_MINUTE) {
		recent.set(userId, stamps);
		return false;
	}
	stamps.push(Date.now());
	recent.set(userId, stamps);
	return true;
}

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

const DEFAULT_TICKET_TEXT = "No he encontrado la respuesta. Puedo abrir un ticket para que el equipo te ayude; revisa el resumen y confírmalo:";

export function chatTurn(input: {
	user: DiscordUser;
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
			let promptChars = 0;

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

				const messages = buildMessages(history, question, hits);
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
					}
				}

				const draft = toolArguments ? parseTicketDraft(toolArguments) : null;
				if (!text.trim() && !draft) throw new Error("empty_completion");

				let proposalId: string | null = null;
				if (draft) {
					if (!text.trim()) text = DEFAULT_TICKET_TEXT;
					proposalId = createProposal({ conversationId: conversation, userId: user.id, ...draft });
				}

				const units = recordUsage(user.id, usage ?? estimateUsage(promptChars, text.length));
				addMessage({ conversationId: conversation, role: "assistant", content: text, units, proposalId });

				sendHtml();
				if (draft && proposalId) send("proposal", { id: proposalId, ...draft });
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
