import type { APIRoute } from "astro";
import { ProposalTtlMs, SettingsProposalTtlMs } from "../../../../lib/chat/config";
import { dashboardAssistantService } from "../../../../lib/chat/DashboardAssistantService";
import { requireGuildApi } from "../../../../lib/dashboard-guard";
import { chatRepository } from "../../../../lib/chat/ChatRepository";
import { json, requireUser } from "../../../../lib/session";
import { botFailure } from "../../../../lib/support-bot";
import { proposalConfirmationService } from "../../../../lib/ProposalConfirmationService";

export const prerender = false;

// confirms or dismisses the assistant's ticket proposal. the model only
// proposes: this route is what opens the ticket, and only if the proposal's
// owner clicks the button. the subject and summary come from what's stored,
// never from the request body.
export const POST: APIRoute = async ({ request, cookies, params }) => {
	const auth = await requireUser(request, cookies);
	if ("response" in auth) return auth.response;
	const { user } = auth;

	const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
	const action = body?.action;
	if (action !== "confirm" && action !== "dismiss") {
		return json({ error: "invalid_body", message: "Acción no válida." }, 400);
	}

	const proposal = chatRepository.getProposal(params.id ?? "");
	if (!proposal || proposal.userId !== user.id) {
		return json({ error: "not_found", message: "Esa propuesta no existe." }, 404);
	}

	if (action === "dismiss") {
		chatRepository.moveProposal(proposal.id, { from: "pending", to: "dismissed" });
		return json({ ok: true });
	}

	// double click or two tabs: the ticket is already open, the same one is returned.
	if (proposal.status === "confirmed" && proposal.ticketId) {
		return json({ ticketId: proposal.ticketId, url: `/support/tickets/${encodeURIComponent(proposal.ticketId)}` });
	}
	if (proposal.status !== "pending") {
		return json({ error: "conflict", message: "Esta propuesta ya no está disponible." }, 409);
	}
	if (Date.now() - Date.parse(proposal.createdAt) > (proposal.kind === "settings" ? SettingsProposalTtlMs : ProposalTtlMs)) {
		return json({ error: "expired", message: "Esta propuesta ha caducado. Pídele al asistente que la vuelva a preparar." }, 410);
	}

	// settings changes: whoever confirms must still be an administrator of the
	// guild (checked now, not when it was proposed), and every change is validated again.
	if (proposal.kind === "settings") {
		const payload = dashboardAssistantService.parsePayload(proposal.payload);
		if (!payload) {
			chatRepository.moveProposal(proposal.id, { from: "pending", to: "dismissed" });
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
