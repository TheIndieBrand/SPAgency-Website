import type { APIRoute } from "astro";
import { CONSENT_VERSION } from "../../../lib/chat/config";
import { saveConsent } from "../../../lib/chat/db";
import { json, requireUser } from "../../../lib/session";

export const prerender = false;

// Guarda que el usuario ha leído y aceptado el aviso (quién, cuándo y qué
// versión del texto). Sin esto el chat no responde.
export const POST: APIRoute = async ({ request, cookies }) => {
	const auth = await requireUser(request, cookies);
	if ("response" in auth) return auth.response;

	saveConsent(auth.user.id, CONSENT_VERSION);
	return json({ ok: true });
};
