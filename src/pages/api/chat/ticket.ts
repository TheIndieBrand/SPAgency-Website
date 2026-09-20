import type { APIRoute } from "astro";
import { ticketCommand } from "../../../lib/chat/run";
import { requireUser } from "../../../lib/session";

export const prerender = false;

// Comando /ticket [descripción]: prepara una propuesta de ticket con lo hablado
// (y la descripción, si la hay). El usuario la confirma luego con el botón, que
// pasa por /api/chat/proposals/:id. La identidad sale de la sesión.
export const POST: APIRoute = async ({ request, cookies }) => {
	const auth = await requireUser(request, cookies);
	if ("response" in auth) return auth.response;

	const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
	return ticketCommand({
		user: auth.user,
		conversationId: typeof body?.conversationId === "string" && body.conversationId ? body.conversationId : undefined,
		note: typeof body?.note === "string" ? body.note : "",
		signal: request.signal,
	});
};
