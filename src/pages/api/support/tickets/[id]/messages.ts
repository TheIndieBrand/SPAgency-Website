import type { APIRoute } from "astro";
import { json, requireUser } from "../../../../../lib/session";
import { botFailure, getTicketMessages, sendTicketMessage } from "../../../../../lib/support-bot";
import { renderMessageHtml, safeAvatar } from "../../../../../lib/support-format";

export const prerender = false;

const MAX_MESSAGE = 2000;

// Consulta de mensajes nuevos (la web la repite cada pocos segundos). Devuelve
// el contenido ya saneado y convertido a HTML: el navegador nunca recibe
// markdown crudo para pintar.
export const GET: APIRoute = async ({ request, cookies, params, url }) => {
	const auth = await requireUser(request, cookies);
	if ("response" in auth) return auth.response;

	// El cursor es un ID de mensaje de Discord (solo dígitos); cualquier otra
	// cosa se descarta en vez de reenviarla al bot.
	const afterParam = url.searchParams.get("after");
	const after = afterParam && /^\d{1,25}$/.test(afterParam) ? afterParam : undefined;

	const result = await getTicketMessages(params.id ?? "", auth.user.id, after);
	if (!result.ok) return botFailure(result);

	const messages = result.data.messages
		.filter((m) => typeof m?.id === "string" && typeof m.content === "string")
		.map((m) => ({
			id: m.id,
			author: m.author === "staff" ? "staff" : "user",
			name: String(m.name ?? "").slice(0, 100),
			avatar: safeAvatar(m.avatar),
			html: renderMessageHtml(m.content),
			at: m.at,
		}));

	return json({ messages });
};

// El usuario escribe en su ticket.
export const POST: APIRoute = async ({ request, cookies, params }) => {
	const auth = await requireUser(request, cookies);
	if ("response" in auth) return auth.response;

	const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
	const content = typeof body?.content === "string" ? body.content.trim() : "";

	if (!content || content.length > MAX_MESSAGE) {
		return json({ error: "invalid_body", message: "El mensaje está vacío o es demasiado largo." }, 400);
	}

	const result = await sendTicketMessage(params.id ?? "", auth.user.id, content);
	return result.ok ? json({ id: result.data.id }) : botFailure(result);
};
