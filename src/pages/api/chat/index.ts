import type { APIRoute } from "astro";
import { chatRunner } from "../../../lib/chat/ChatRunner";
import { tokenFromCookies } from "../../../lib/dashboard-guard";
import { requireUser } from "../../../lib/session";

export const prerender = false;

// a user message → the assistant's streamed answer (sse). identity comes from
// the session; the body only carries the text and, if it continues a
// conversation, its id (checked as belonging to the user).
export const POST: APIRoute = async ({ request, cookies }) => {
	const auth = await requireUser(request, cookies);
	if ("response" in auth) return auth.response;

	const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
	const message = typeof body?.message === "string" ? body.message : "";
	const conversationId = typeof body?.conversationId === "string" && body.conversationId ? body.conversationId : undefined;

	// discord's token is only used to check the user's guilds; it never reaches the model.
	const { token } = tokenFromCookies(cookies);
	return chatRunner.chatTurn({ user: auth.user, accessToken: token ?? "", conversationId, message, signal: request.signal });
};
