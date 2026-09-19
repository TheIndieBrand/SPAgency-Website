import type { APIRoute } from "astro";
import { userAvatarUrl } from "../../../../lib/discord";
import { json, requireUser } from "../../../../lib/session";
import { botFailure, createTicket } from "../../../../lib/support-bot";

export const prerender = false;

const MAX_SUBJECT = 100;
const MAX_MESSAGE = 2000;

// Abre un ticket. La identidad sale de la sesión, nunca del cuerpo: el bot se
// fía del userId que le pasamos porque la petición va de servidor a servidor.
export const POST: APIRoute = async ({ request, cookies }) => {
	const auth = await requireUser(request, cookies);
	if ("response" in auth) return auth.response;

	const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
	const subject = typeof body?.subject === "string" ? body.subject.trim() : "";
	const message = typeof body?.message === "string" ? body.message.trim() : "";

	if (!subject || subject.length > MAX_SUBJECT || !message || message.length > MAX_MESSAGE) {
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
