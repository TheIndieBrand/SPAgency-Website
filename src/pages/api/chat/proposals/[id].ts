import type { APIRoute } from "astro";
import { PROPOSAL_TTL_MS } from "../../../../lib/chat/config";
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
	if (Date.now() - Date.parse(proposal.createdAt) > PROPOSAL_TTL_MS) {
		return json({ error: "expired", message: "Esta propuesta ha caducado. Pídele al asistente que la vuelva a preparar." }, 410);
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
