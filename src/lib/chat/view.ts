import { renderMessageHtml } from "../support-format";
import { PROPOSAL_TTL_MS } from "./config";
import type { Proposal, StoredMessage } from "./db";

// Lo que ve el navegador de un mensaje guardado: el markdown ya formateado y
// saneado en el servidor (nunca se inyecta texto crudo en la página).

export interface ProposalView {
	id: string;
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

export function proposalView(p: Proposal): ProposalView {
	const expired = p.status === "pending" && Date.now() - Date.parse(p.createdAt) > PROPOSAL_TTL_MS;
	return {
		id: p.id,
		subject: p.subject,
		summary: p.summary,
		// "confirming" es transitorio (se está creando el ticket): para la interfaz, sigue pendiente.
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
