import type { DiscordUser } from "./discord";
import { userAvatarUrl } from "./discord";
import { applySettings, outcomeNote, type SettingsPayload } from "./chat/dashboard";
import { addMessage, moveProposal, setConversationTicket, type Proposal } from "./chat/db";
import { ticketFirstMessage } from "./chat/ticket";
import { renderMessageHtml } from "./support-format";
import { createTicket } from "./support-bot";

export type SettingsConfirmResult =
	| { ok: true; applied: number; failed: number; html: string }
	| { ok: false; status: 409 | 503; error: string; message: string };

export type TicketConfirmResult =
	| { ok: true; ticketId: string; url: string }
	| { ok: false; status: 409; error: string; message: string }
	| { ok: false; botError: { status: number; error: string } };

/**
 * applies a confirmed assistant proposal: either a batch of settings changes,
 * or a support ticket. the proposal has already been checked (owner, ttl,
 * status) by the route — this class only does the state transition and the
 * side effect (writing the settings, or opening the ticket).
 */
export class ProposalConfirmationService {
	/**
	 * applies a settings-change proposal the user just confirmed.
	 * @param proposal - the proposal row, already validated as pending.
	 * @param payload - the settings changes to apply.
	 * @param userId - the discord id of the user confirming.
	 * @returns the outcome, or why it could not be applied.
	 */
	async confirmSettings(proposal: Proposal, payload: SettingsPayload, userId: string): Promise<SettingsConfirmResult> {
		if (!moveProposal(proposal.id, { from: "pending", to: "confirming" })) {
			return { ok: false, status: 409, error: "conflict", message: "Esta propuesta ya se está procesando." };
		}

		const outcomes = await applySettings(payload, userId);
		if (outcomes.every((o) => !o.ok && o.unavailable)) {
			// the database didn't respond: nothing changed, safe to retry.
			moveProposal(proposal.id, { from: "confirming", to: "pending" });
			return { ok: false, status: 503, error: "unavailable", message: "No se pudo guardar: la base de datos no responde. Inténtalo de nuevo." };
		}

		moveProposal(proposal.id, { from: "confirming", to: "confirmed" });
		const note = outcomeNote(payload, outcomes);
		addMessage({ conversationId: proposal.conversationId, role: "note", content: note });
		return { ok: true, applied: outcomes.filter((o) => o.ok).length, failed: outcomes.filter((o) => !o.ok).length, html: renderMessageHtml(note) };
	}

	/**
	 * opens the support ticket a confirmed proposal describes.
	 * @param proposal - the proposal row, already validated as pending.
	 * @param user - the discord user confirming the proposal.
	 * @returns the opened ticket, or why it could not be opened.
	 */
	async confirmTicket(proposal: Proposal, user: DiscordUser): Promise<TicketConfirmResult> {
		if (!moveProposal(proposal.id, { from: "pending", to: "confirming" })) {
			return { ok: false, status: 409, error: "conflict", message: "Esta propuesta ya se está procesando." };
		}

		const result = await createTicket({
			userId: user.id,
			username: user.global_name || user.username,
			avatarUrl: userAvatarUrl(user),
			subject: proposal.subject,
			message: ticketFirstMessage(proposal, proposal.conversationId),
		});

		if (!result.ok) {
			// didn't open: the proposal goes back to available so it can be retried.
			moveProposal(proposal.id, { from: "confirming", to: "pending" });
			return { ok: false, botError: result };
		}

		const { ticketId } = result.data;
		moveProposal(proposal.id, { from: "confirming", to: "confirmed", ticketId });
		setConversationTicket(proposal.conversationId, ticketId);
		const url = `/support/tickets/${encodeURIComponent(ticketId)}`;
		addMessage({
			conversationId: proposal.conversationId,
			role: "note",
			content: `Ticket abierto: **${proposal.subject}**. Sigue la conversación con el staff en [tu ticket](${url}); su primer mensaje lo ha generado la IA con el resumen de este chat.`,
		});

		return { ok: true, ticketId, url };
	}
}

export const proposalConfirmationService = new ProposalConfirmationService();
