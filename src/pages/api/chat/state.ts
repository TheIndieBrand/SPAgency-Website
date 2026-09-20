import type { APIRoute } from "astro";
import { CONSENT_VERSION, MAX_INPUT_CHARS, chatConfigured } from "../../../lib/chat/config";
import { hasConsent, listConversations } from "../../../lib/chat/db";
import { siteRoutes } from "../../../lib/chat/knowledge";
import { isStaff } from "../../../lib/chat/staff";
import { usageState } from "../../../lib/chat/usage";
import { json, requireUser } from "../../../lib/session";

export const prerender = false;

// Todo lo que necesita la interfaz para arrancar: si el asistente está
// disponible, si ya aceptó el aviso, cuánto ha gastado hoy y sus conversaciones.
export const GET: APIRoute = async ({ request, cookies }) => {
	const auth = await requireUser(request, cookies);
	if ("response" in auth) return auth.response;
	const { user } = auth;

	return json({
		configured: chatConfigured(),
		consented: hasConsent(user.id, CONSENT_VERSION),
		maxInputChars: MAX_INPUT_CHARS,
		usage: usageState(user.id),
		staff: isStaff(user),
		routes: siteRoutes(),
		conversations: listConversations(user.id).map((c) => ({
			id: c.id,
			title: c.title,
			updatedAt: c.updatedAt,
			ticketId: c.ticketId,
		})),
	});
};
