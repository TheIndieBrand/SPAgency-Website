import type { APIRoute } from "astro";
import { chatRepository } from "../../../../lib/chat/ChatRepository";
import { requireStaff } from "../../../../lib/chat/staff";
import { messageViews } from "../../../../lib/chat/view";
import { json } from "../../../../lib/session";

export const prerender = false;

// reading a conversation is logged (who, and when): staff access is an
// exception disclosed to users, and it should be possible to prove its use.
export const GET: APIRoute = async ({ request, cookies, params }) => {
	const auth = await requireStaff(request, cookies);
	if ("response" in auth) return auth.response;

	const id = params.id ?? "";
	const conversation = chatRepository.getConversation(id);
	if (!conversation) return json({ error: "not_found", message: "Esa conversación no existe." }, 404);

	chatRepository.logStaffAction({ staffId: auth.user.id, action: "read", conversationId: id, targetUserId: conversation.userId });

	return json({
		conversation,
		messages: messageViews(chatRepository.listMessages(id), chatRepository.listProposals(id), true),
	});
};

// only staff can delete. the log keeps who did it and which conversation it
// was, but not its content.
export const DELETE: APIRoute = async ({ request, cookies, params }) => {
	const auth = await requireStaff(request, cookies);
	if ("response" in auth) return auth.response;

	const id = params.id ?? "";
	const conversation = chatRepository.getConversation(id);
	if (!conversation) return json({ error: "not_found", message: "Esa conversación no existe." }, 404);

	chatRepository.deleteConversation(id);
	chatRepository.logStaffAction({
		staffId: auth.user.id,
		action: "delete",
		conversationId: id,
		targetUserId: conversation.userId,
		detail: conversation.title,
	});

	return json({ ok: true });
};
