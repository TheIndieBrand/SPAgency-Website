import { renderMessageHtml } from "../support-format";
import { ProposalTtlMs, SettingsProposalTtlMs } from "./config";
import type { Proposal, StoredMessage } from "./ChatRepository";

// what the browser sees of a stored message: the markdown already formatted
// and sanitized on the server (raw text is never injected into the page).

export interface ProposalView {
	id: string;
	kind: "ticket" | "settings";
	// only on settings-change proposals: the guild they'd be applied to.
	guild: string | null;
	subject: string;
	summary: string;
	status: "pending" | "confirmed" | "dismissed" | "expired";
	ticketId: string | null;
}

export interface MessageView {
	id: number;
	role: StoredMessage["role"];
	html: string;
	at: string;
	proposal: ProposalView | null;
	units?: number;
}

function guildNameOf(payload: string | null): string | null {
	try {
		const name = (JSON.parse(payload ?? "") as { guildName?: unknown }).guildName;
		return typeof name === "string" ? name : null;
	} catch {
		return null;
	}
}

export function proposalView(p: Proposal): ProposalView {
	const ttl = p.kind === "settings" ? SettingsProposalTtlMs : ProposalTtlMs;
	const expired = p.status === "pending" && Date.now() - Date.parse(p.createdAt) > ttl;
	return {
		id: p.id,
		kind: p.kind,
		guild: p.kind === "settings" ? guildNameOf(p.payload) : null,
		subject: p.subject,
		summary: p.summary,
		// "confirming" is transient (the ticket is being created): for the ui, it's still pending.
		status: expired ? "expired" : p.status === "confirming" ? "pending" : p.status,
		ticketId: p.ticketId,
	};
}

export function messageViews(messages: StoredMessage[], proposals: Proposal[], withUnits = false): MessageView[] {
	const byId = new Map(proposals.map((p) => [p.id, p]));
	return messages.map((m) => {
		const proposal = m.proposalId ? byId.get(m.proposalId) : undefined;
		return {
			id: m.id,
			role: m.role,
			html: renderMessageHtml(m.content),
			at: m.createdAt,
			proposal: proposal ? proposalView(proposal) : null,
			...(withUnits ? { units: m.units } : {}),
		};
	});
}
