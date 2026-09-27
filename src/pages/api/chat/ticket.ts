import type { APIRoute } from "astro";
import { chatRunner } from "../../../lib/chat/ChatRunner";
import { requireUser } from "../../../lib/session";

export const prerender = false;

// /ticket [description] command: prepares a ticket proposal from what was
// discussed (and the description, if given). the user confirms it later with
// the button, which goes through /api/chat/proposals/:id. identity comes from the session.
export const POST: APIRoute = async ({ request, cookies }) => {
	const auth = await requireUser(request, cookies);
	if ("response" in auth) return auth.response;

	const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
	return chatRunner.ticketCommand({
		user: auth.user,
		conversationId: typeof body?.conversationId === "string" && body.conversationId ? body.conversationId : undefined,
		note: typeof body?.note === "string" ? body.note : "",
		signal: request.signal,
	});
};
