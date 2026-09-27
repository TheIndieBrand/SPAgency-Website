import type { APIRoute } from "astro";
import { userAvatarUrl } from "../../../../lib/discord";
import { json, requireUser } from "../../../../lib/session";
import { botFailure, createTicket } from "../../../../lib/support-bot";
import { MaxMessageLength, MaxSubjectLength } from "../../../../lib/Ticket.constants";

export const prerender = false;

// opens a ticket. identity comes from the session, never from the request
// body: the bot trusts the userId we pass it because the request is server to server.
export const POST: APIRoute = async ({ request, cookies }) => {
	const auth = await requireUser(request, cookies);
	if ("response" in auth) return auth.response;

	const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
	const subject = typeof body?.subject === "string" ? body.subject.trim() : "";
	const message = typeof body?.message === "string" ? body.message.trim() : "";

	if (!subject || subject.length > MaxSubjectLength || !message || message.length > MaxMessageLength) {
		return json({ error: "invalid_body", message: "Revisa el asunto y el mensaje." }, 400);
	}

	const { user } = auth;
	const result = await createTicket({
		userId: user.id,
		username: user.global_name || user.username,
		avatarUrl: userAvatarUrl(user),
		subject,
		message,
	});

	return result.ok ? json({ ticketId: result.data.ticketId }, 201) : botFailure(result);
};
