// Ticket que abre el asistente a petición del usuario. El primer mensaje lo
// redacta la IA (a partir de la conversación) y así se dice, para que ni el
// usuario ni el staff lo confundan con algo que escribió una persona.

const MAX_SUBJECT = 100;
const MAX_MESSAGE = 2000; // límite del contrato con el bot (docs/support.md)

export interface TicketDraft {
	subject: string;
	summary: string;
}

// Lo que devuelve el modelo no es de fiar: se valida y se recorta.
export function parseTicketDraft(raw: string): TicketDraft | null {
	try {
		const data = JSON.parse(raw) as Record<string, unknown>;
		const subject = typeof data.subject === "string" ? data.subject.replace(/\s+/g, " ").trim() : "";
		const summary = typeof data.summary === "string" ? data.summary.trim() : "";
		if (!subject || !summary) return null;
		return { subject: subject.slice(0, MAX_SUBJECT), summary: summary.slice(0, 900) };
	} catch {
		return null;
	}
}

export function ticketFirstMessage(draft: TicketDraft, conversationId: string): string {
	const header = "🤖 **Mensaje generado con IA.** Lo redactó el asistente de SP Agency a partir de la conversación del usuario en el chat, y puede contener errores.";
	const footer = `_Conversación del chat: \`${conversationId}\`_`;
	return `${header}\n\n${draft.summary}\n\n${footer}`.slice(0, MAX_MESSAGE);
}
