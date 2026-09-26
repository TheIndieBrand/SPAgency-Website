import type { APIRoute } from "astro";
import { chatRepository } from "../../../../lib/chat/ChatRepository";
import { requireStaff } from "../../../../lib/chat/staff";
import { json } from "../../../../lib/session";

export const prerender = false;

// list of conversations (all of them, from every user), searchable by
// conversation id, user id, user name or title.
export const GET: APIRoute = async ({ request, cookies, url }) => {
	const auth = await requireStaff(request, cookies);
	if ("response" in auth) return auth.response;

	const q = (url.searchParams.get("q") ?? "").slice(0, 100);
	if (q) chatRepository.logStaffAction({ staffId: auth.user.id, action: "search", detail: q });

	return json({ conversations: chatRepository.searchConversations(q) });
};
