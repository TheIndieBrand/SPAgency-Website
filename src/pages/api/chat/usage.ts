import type { APIRoute } from "astro";
import { usageReport } from "../../../lib/chat/usage";
import { json, requireUser } from "../../../lib/session";

export const prerender = false;

// Comando /usage: el consumo detallado de quien pregunta. No llama al modelo, así
// que no gasta nada (y no exige haber aceptado el aviso: solo son sus propios datos).
export const GET: APIRoute = async ({ request, cookies }) => {
	const auth = await requireUser(request, cookies);
	if ("response" in auth) return auth.response;

	return json(usageReport(auth.user.id));
};
