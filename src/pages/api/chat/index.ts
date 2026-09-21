import type { APIRoute } from "astro";
import { chatTurn } from "../../../lib/chat/run";
import { tokenFromCookies } from "../../../lib/dashboard-guard";
import { requireUser } from "../../../lib/session";

export const prerender = false;

// Un mensaje del usuario → respuesta del asistente en streaming (SSE). La
// identidad sale de la sesión; el cuerpo solo trae el texto y, si continúa una
// conversación, su ID (que se comprueba que sea suya).
export const POST: APIRoute = async ({ request, cookies }) => {
	const auth = await requireUser(request, cookies);
	if ("response" in auth) return auth.response;

	const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
	const message = typeof body?.message === "string" ? body.message : "";
	const conversationId = typeof body?.conversationId === "string" && body.conversationId ? body.conversationId : undefined;

	// El token de Discord solo sirve para comprobar sus servidores; nunca llega al modelo.
	const { token } = tokenFromCookies(cookies);
	return chatTurn({ user: auth.user, accessToken: token ?? "", conversationId, message, signal: request.signal });
};
