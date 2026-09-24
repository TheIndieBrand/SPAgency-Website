import { Marked } from "marked";
import sanitizeHtml from "sanitize-html";

const marked = new Marked({ gfm: true, breaks: true });

// Los mensajes llegan como markdown de Discord, escritos por el staff o por el
// propio usuario. Se pintan saneados: solo texto con formato básico y enlaces
// http(s); nada de imágenes, HTML crudo, títulos ni manejadores de eventos.
export function renderMessageHtml(content: string): string {
	return sanitizeHtml(marked.parse(content) as string, {
		allowedTags: ["p", "br", "strong", "em", "del", "code", "pre", "blockquote", "a", "ul", "ol", "li"],
		allowedAttributes: { a: ["href", "rel", "target"] },
		allowedSchemes: ["http", "https"],
		allowProtocolRelative: false,
		transformTags: {
			a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer nofollow", target: "_blank" }),
		},
	});
}

// El avatar lo manda el bot, pero solo se admite si apunta a la CDN de Discord:
// así, aunque algo raro llegara, nunca se carga una imagen de un tercero.
export function safeAvatar(url: unknown): string | null {
	if (typeof url !== "string") return null;
	try {
		const parsed = new URL(url);
		const trusted = parsed.hostname === "cdn.discordapp.com" || parsed.hostname === "media.discordapp.net";
		return parsed.protocol === "https:" && trusted ? parsed.toString() : null;
	} catch {
		return null;
	}
}

// Códigos de error de la API del bot → mensaje para el usuario.
const MESSAGES: Record<string, string> = {
	too_many_open_tickets: "Ya tienes un ticket abierto. Ciérralo antes de abrir otro.",
	cooldown: "Espera unos segundos antes de volver a intentarlo.",
	closing: "Este ticket se está cerrando.",
	ticket_full: "Este ticket ha alcanzado su límite de mensajes. Ciérralo y abre uno nuevo.",
	daily_limit: "Has alcanzado el límite de tickets de hoy. Inténtalo mañana.",
	support_full: "Soporte está saturado ahora mismo. Inténtalo de nuevo más tarde.",
	invalid_body: "Revisa el asunto y el mensaje.",
	not_found: "Este ticket ya no existe.",
	unauthorized: "Inicia sesión para continuar.",
};

const UNAVAILABLE = "Soporte no está disponible ahora mismo. Inténtalo de nuevo en unos minutos.";

export function supportErrorMessage(error: string, status: number): string {
	if (MESSAGES[error]) return MESSAGES[error];
	if (status >= 500) return UNAVAILABLE;
	return "No se pudo completar la acción.";
}
