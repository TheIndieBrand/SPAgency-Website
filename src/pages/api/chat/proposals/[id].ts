import type { APIRoute } from "astro";
import { PROPOSAL_TTL_MS, SETTINGS_PROPOSAL_TTL_MS } from "../../../../lib/chat/config";
import { parsePayload } from "../../../../lib/chat/dashboard";
import { requireGuildApi } from "../../../../lib/dashboard-guard";
import { getProposal, moveProposal } from "../../../../lib/chat/db";
import { json, requireUser } from "../../../../lib/session";
import { botFailure } from "../../../../lib/support-bot";
import { proposalConfirmationService } from "../../../../lib/ProposalConfirmationService";

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
		moveProposal(proposal.id, { from: "pending", to: "dismissed" });
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
			moveProposal(proposal.id, { from: "pending", to: "dismissed" });
			return json({ error: "invalid", message: "Esta propuesta ya no es válida. Pídele al asistente que la prepare de nuevo." }, 410);
		}
		const guard = await requireGuildApi(request, cookies, payload.guildId);
		if ("response" in guard) return guard.response;

		const result = await proposalConfirmationService.confirmSettings(proposal, payload, user.id);
		if (!result.ok) return json({ error: result.error, message: result.message }, result.status);
		return json({ applied: result.applied, failed: result.failed, html: result.html });
	}

	const result = await proposalConfirmationService.confirmTicket(proposal, user);
	if (!result.ok) {
		if ("botError" in result) return botFailure(result.botError);
		return json({ error: result.error, message: result.message }, result.status);
	}
	return json({ ticketId: result.ticketId, url: result.url }, 201);
};
