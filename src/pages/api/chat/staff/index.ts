import type { APIRoute } from "astro";
import { logStaffAction, searchConversations } from "../../../../lib/chat/db";
import { requireStaff } from "../../../../lib/chat/staff";
import { json } from "../../../../lib/session";

export const prerender = false;

// Lista de conversaciones (todas, de todos los usuarios), con búsqueda por ID de
// conversación, ID de usuario, nombre o título.
export const GET: APIRoute = async ({ request, cookies, url }) => {
	const auth = await requireStaff(request, cookies);
	if ("response" in auth) return auth.response;

	const q = (url.searchParams.get("q") ?? "").slice(0, 100);
	if (q) logStaffAction({ staffId: auth.user.id, action: "search", detail: q });

	return json({ conversations: searchConversations(q) });
};
