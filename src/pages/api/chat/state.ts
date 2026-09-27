import type { APIRoute } from "astro";
import { ConsentVersion, MaxInputChars, chatConfigured } from "../../../lib/chat/config";
import { chatRepository } from "../../../lib/chat/ChatRepository";
import { knowledgeBase } from "../../../lib/chat/KnowledgeBase";
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
		consented: chatRepository.hasConsent(user.id, ConsentVersion),
		maxInputChars: MaxInputChars,
		usage: usageState(user.id),
		staff: isStaff(user),
		routes: knowledgeBase.siteRoutes(),
		conversations: chatRepository.listConversations(user.id).map((c) => ({
			id: c.id,
			title: c.title,
			updatedAt: c.updatedAt,
			ticketId: c.ticketId,
		})),
	});
};
