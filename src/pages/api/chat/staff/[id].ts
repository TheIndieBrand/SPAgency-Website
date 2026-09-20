import type { APIRoute } from "astro";
import { deleteConversation, getConversation, listMessages, listProposals, logStaffAction } from "../../../../lib/chat/db";
import { requireStaff } from "../../../../lib/chat/staff";
import { messageViews } from "../../../../lib/chat/view";
import { json } from "../../../../lib/session";

export const prerender = false;

// Leer una conversación queda registrado (quién y cuándo): el acceso del staff
// es una excepción avisada a los usuarios, y conviene poder demostrar su uso.
export const GET: APIRoute = async ({ request, cookies, params }) => {
	const auth = await requireStaff(request, cookies);
	if ("response" in auth) return auth.response;

	const id = params.id ?? "";
	const conversation = getConversation(id);
	if (!conversation) return json({ error: "not_found", message: "Esa conversación no existe." }, 404);

	logStaffAction({ staffId: auth.user.id, action: "read", conversationId: id, targetUserId: conversation.userId });

	return json({
		conversation,
		messages: messageViews(listMessages(id), listProposals(id), true),
	});
};

// Solo el staff puede borrar. El registro conserva quién lo hizo y de qué
// conversación se trataba, pero no su contenido.
export const DELETE: APIRoute = async ({ request, cookies, params }) => {
	const auth = await requireStaff(request, cookies);
	if ("response" in auth) return auth.response;

	const id = params.id ?? "";
	const conversation = getConversation(id);
	if (!conversation) return json({ error: "not_found", message: "Esa conversación no existe." }, 404);

	deleteConversation(id);
	logStaffAction({
		staffId: auth.user.id,
		action: "delete",
		conversationId: id,
		targetUserId: conversation.userId,
		detail: conversation.title,
	});

	return json({ ok: true });
};
