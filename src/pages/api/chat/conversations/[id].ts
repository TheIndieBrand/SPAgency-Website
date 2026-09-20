import type { APIRoute } from "astro";
import { getConversation, listMessages, listProposals } from "../../../../lib/chat/db";
import { messageViews } from "../../../../lib/chat/view";
import { json, requireUser } from "../../../../lib/session";

export const prerender = false;

export const GET: APIRoute = async ({ request, cookies, params }) => {
	const auth = await requireUser(request, cookies);
	if ("response" in auth) return auth.response;

	const id = params.id ?? "";
	const conversation = getConversation(id);
	// Una conversación ajena es como si no existiera.
	if (!conversation || conversation.userId !== auth.user.id) {
		return json({ error: "not_found", message: "Esa conversación no existe." }, 404);
	}

	return json({
		id: conversation.id,
		title: conversation.title,
		ticketId: conversation.ticketId,
		messages: messageViews(listMessages(id), listProposals(id)),
	});
};
