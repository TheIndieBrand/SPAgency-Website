import type { APIRoute } from "astro";
import { CONSENT_VERSION } from "../../../lib/chat/config";
import { chatRepository } from "../../../lib/chat/ChatRepository";
import { json, requireUser } from "../../../lib/session";

export const prerender = false;

// records that the user has read and accepted the notice (who, when, and
// which version of the text). without this the chat doesn't respond.
export const POST: APIRoute = async ({ request, cookies }) => {
	const auth = await requireUser(request, cookies);
	if ("response" in auth) return auth.response;

	chatRepository.saveConsent(auth.user.id, CONSENT_VERSION);
	return json({ ok: true });
};
