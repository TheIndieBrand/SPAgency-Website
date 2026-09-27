// the ticket the assistant opens on the user's request. the first message is
// drafted by the ai (from the conversation), and it says so, so neither the
// user nor staff mistake it for something a person wrote.

import { MaxMessageLength, MaxSubjectLength } from "../Ticket.constants";

export interface TicketDraft {
	subject: string;
	summary: string;
}

// what the model returns isn't trusted: it's validated and trimmed.
export function parseTicketDraft(raw: string): TicketDraft | null {
	try {
		const data = JSON.parse(raw) as Record<string, unknown>;
		const subject = typeof data.subject === "string" ? data.subject.replace(/\s+/g, " ").trim() : "";
		const summary = typeof data.summary === "string" ? data.summary.trim() : "";
		if (!subject || !summary) return null;
		return { subject: subject.slice(0, MaxSubjectLength), summary: summary.slice(0, 900) };
	} catch {
		return null;
	}
}

export function ticketFirstMessage(draft: TicketDraft, conversationId: string): string {
	const header = "🤖 **Mensaje generado con IA.** Lo redactó el asistente de SP Agency a partir de la conversación del usuario en el chat, y puede contener errores.";
	const footer = `_Conversación del chat: \`${conversationId}\`_`;
	// MaxMessageLength: the bot's contract limit (docs/support.md).
	return `${header}\n\n${draft.summary}\n\n${footer}`.slice(0, MaxMessageLength);
}
