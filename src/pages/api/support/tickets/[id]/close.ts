import type { APIRoute } from "astro";
import { json, requireUser } from "../../../../../lib/session";
import { botFailure, closeTicket } from "../../../../../lib/support-bot";

export const prerender = false;

// El usuario cierra su ticket. El bot responde en cuanto empieza el cierre; el
// transcript llega después por /api/support/transcripts y, con él guardado, el
// bot borra el canal (entonces la consulta de mensajes empieza a dar 404).
export const POST: APIRoute = async ({ request, cookies, params }) => {
	const auth = await requireUser(request, cookies);
	if ("response" in auth) return auth.response;

	const result = await closeTicket(params.id ?? "", auth.user.id);
	return result.ok ? json({ closing: true }, 202) : botFailure(result);
};
