import type { APIRoute } from "astro";
import { CONSENT_VERSION, MAX_INPUT_CHARS, chatConfigured } from "../../../lib/chat/config";
import { chatRepository } from "../../../lib/chat/ChatRepository";
import { siteRoutes } from "../../../lib/chat/knowledge";
import { isStaff } from "../../../lib/chat/staff";
import { usageState } from "../../../lib/chat/usage";
import { json, requireUser } from "../../../lib/session";

export const prerender = false;

// everything the ui needs to start up: whether the assistant is available,
// whether the user already accepted the notice, today's usage, and their conversations.
export const GET: APIRoute = async ({ request, cookies }) => {
	const auth = await requireUser(request, cookies);
	if ("response" in auth) return auth.response;
	const { user } = auth;

	return json({
		configured: chatConfigured(),
		consented: chatRepository.hasConsent(user.id, CONSENT_VERSION),
		maxInputChars: MAX_INPUT_CHARS,
		usage: usageState(user.id),
		staff: isStaff(user),
		routes: siteRoutes(),
		conversations: chatRepository.listConversations(user.id).map((c) => ({
			id: c.id,
			title: c.title,
			updatedAt: c.updatedAt,
			ticketId: c.ticketId,
		})),
	});
};
