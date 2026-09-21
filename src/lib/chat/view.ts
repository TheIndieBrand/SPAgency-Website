import { renderMessageHtml } from "../support-format";
import { PROPOSAL_TTL_MS, SETTINGS_PROPOSAL_TTL_MS } from "./config";
import type { Proposal, StoredMessage } from "./db";

// Lo que ve el navegador de un mensaje guardado: el markdown ya formateado y
// saneado en el servidor (nunca se inyecta texto crudo en la página).

export interface ProposalView {
	id: string;
	kind: "ticket" | "settings";
	// Solo en propuestas de cambios: el servidor donde se aplicarían.
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
	const ttl = p.kind === "settings" ? SETTINGS_PROPOSAL_TTL_MS : PROPOSAL_TTL_MS;
	const expired = p.status === "pending" && Date.now() - Date.parse(p.createdAt) > ttl;
	return {
		id: p.id,
		kind: p.kind,
		guild: p.kind === "settings" ? guildNameOf(p.payload) : null,
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
