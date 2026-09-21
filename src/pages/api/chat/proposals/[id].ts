import type { APIRoute } from "astro";
import { PROPOSAL_TTL_MS, SETTINGS_PROPOSAL_TTL_MS } from "../../../../lib/chat/config";
import { applySettings, outcomeNote, parsePayload } from "../../../../lib/chat/dashboard";
import { requireGuildApi } from "../../../../lib/dashboard-guard";
import { renderMessageHtml } from "../../../../lib/support-format";
import { addMessage, getProposal, moveProposal, setConversationTicket } from "../../../../lib/chat/db";
import { ticketFirstMessage } from "../../../../lib/chat/ticket";
import { userAvatarUrl } from "../../../../lib/discord";
import { json, requireUser } from "../../../../lib/session";
import { botFailure, createTicket } from "../../../../lib/support-bot";

export const prerender = false;

// Confirma o descarta la propuesta de ticket del asistente. El modelo solo
// propone: quien abre el ticket es esta ruta, y solo si el dueño de la propuesta
// pulsa el botón. El asunto y el resumen salen de lo guardado, no del cuerpo.
export const POST: APIRoute = async ({ request, cookies, params }) => {
	const auth = await requireUser(request, cookies);
	if ("response" in auth) return auth.response;
	const { user } = auth;

	const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
	const action = body?.action;
	if (action !== "confirm" && action !== "dismiss") {
		return json({ error: "invalid_body", message: "Acción no válida." }, 400);
	}

	const proposal = getProposal(params.id ?? "");
	if (!proposal || proposal.userId !== user.id) {
		return json({ error: "not_found", message: "Esa propuesta no existe." }, 404);
	}

	if (action === "dismiss") {
		moveProposal(proposal.id, "pending", "dismissed");
		return json({ ok: true });
	}

	// Doble clic o dos pestañas: el ticket ya está abierto, se devuelve el mismo.
	if (proposal.status === "confirmed" && proposal.ticketId) {
		return json({ ticketId: proposal.ticketId, url: `/support/tickets/${encodeURIComponent(proposal.ticketId)}` });
	}
	if (proposal.status !== "pending") {
		return json({ error: "conflict", message: "Esta propuesta ya no está disponible." }, 409);
	}
	if (Date.now() - Date.parse(proposal.createdAt) > (proposal.kind === "settings" ? SETTINGS_PROPOSAL_TTL_MS : PROPOSAL_TTL_MS)) {
		return json({ error: "expired", message: "Esta propuesta ha caducado. Pídele al asistente que la vuelva a preparar." }, 410);
	}
	// Cambios de configuración: quien confirma debe seguir siendo administrador del servidor
	// (se comprueba ahora, no cuando se propuso) y cada cambio se vuelve a validar.
	if (proposal.kind === "settings") {
		const payload = parsePayload(proposal.payload);
		if (!payload) {
			moveProposal(proposal.id, "pending", "dismissed");
			return json({ error: "invalid", message: "Esta propuesta ya no es válida. Pídele al asistente que la prepare de nuevo." }, 410);
		}
		const guard = await requireGuildApi(request, cookies, payload.guildId);
		if ("response" in guard) return guard.response;
		if (!moveProposal(proposal.id, "pending", "confirming")) {
			return json({ error: "conflict", message: "Esta propuesta ya se está procesando." }, 409);
		}

		const outcomes = await applySettings(payload, user.id);
		if (outcomes.every((o) => !o.ok && o.unavailable)) {
			// La base no respondió: no se cambió nada y se puede reintentar.
			moveProposal(proposal.id, "confirming", "pending");
			return json({ error: "unavailable", message: "No se pudo guardar: la base de datos no responde. Inténtalo de nuevo." }, 503);
		}
		moveProposal(proposal.id, "confirming", "confirmed");
		const note = outcomeNote(payload, outcomes);
		addMessage({ conversationId: proposal.conversationId, role: "note", content: note });
		return json({ applied: outcomes.filter((o) => o.ok).length, failed: outcomes.filter((o) => !o.ok).length, html: renderMessageHtml(note) });
	}

	if (!moveProposal(proposal.id, "pending", "confirming")) {
		return json({ error: "conflict", message: "Esta propuesta ya se está procesando." }, 409);
	}

	const result = await createTicket({
		userId: user.id,
		username: user.global_name || user.username,
		avatarUrl: userAvatarUrl(user),
		subject: proposal.subject,
		message: ticketFirstMessage(proposal, proposal.conversationId),
	});

	if (!result.ok) {
		// No se abrió: la propuesta vuelve a estar disponible para reintentar.
		moveProposal(proposal.id, "confirming", "pending");
		return botFailure(result);
	}

	const { ticketId } = result.data;
	moveProposal(proposal.id, "confirming", "confirmed", ticketId);
	setConversationTicket(proposal.conversationId, ticketId);
	const url = `/support/tickets/${encodeURIComponent(ticketId)}`;
	addMessage({
		conversationId: proposal.conversationId,
		role: "note",
		content: `Ticket abierto: **${proposal.subject}**. Sigue la conversación con el staff en [tu ticket](${url}); su primer mensaje lo ha generado la IA con el resumen de este chat.`,
	});

	return json({ ticketId, url }, 201);
};
