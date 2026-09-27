import type { APIRoute } from "astro";
import { chatRepository } from "../../../../lib/chat/ChatRepository";
import { messageViews } from "../../../../lib/chat/view";
import { json, requireUser } from "../../../../lib/session";

export const prerender = false;

export const GET: APIRoute = async ({ request, cookies, params }) => {
	const auth = await requireUser(request, cookies);
	if ("response" in auth) return auth.response;

	const id = params.id ?? "";
	const conversation = chatRepository.getConversation(id);
	// someone else's conversation is treated as if it doesn't exist.
	if (!conversation || conversation.userId !== auth.user.id) {
		return json({ error: "not_found", message: "Esa conversación no existe." }, 404);
	}

	return json({
		id: conversation.id,
		title: conversation.title,
		ticketId: conversation.ticketId,
		guild: chatRepository.getConversationGuild(id),
		messages: messageViews(chatRepository.listMessages(id), chatRepository.listProposals(id)),
	});
};
