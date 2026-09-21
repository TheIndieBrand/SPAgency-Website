import type { APIRoute } from "astro";
import { dashboardCommand, type DashboardCommand } from "../../../lib/chat/commands";
import { tokenFromCookies } from "../../../lib/dashboard-guard";
import { json, requireUser } from "../../../lib/session";

export const prerender = false;

const NAMES = new Set<DashboardCommand>(["servidor", "config", "panico", "registros"]);

// Comandos del chat sobre el dashboard (/servidor, /config, /panico, /registros).
// No llaman al modelo. La identidad sale de la sesión; qué servidor se toca lo decide
// la elección guardada del usuario, comprobada contra Discord en cada uso.
export const POST: APIRoute = async ({ request, cookies }) => {
	const auth = await requireUser(request, cookies);
	if ("response" in auth) return auth.response;
	const { token } = tokenFromCookies(cookies);
	if (!token) return json({ error: "unauthorized", message: "Inicia sesión para continuar." }, 401);

	const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
	const name = body?.name as DashboardCommand;
	if (typeof name !== "string" || !NAMES.has(name)) return json({ error: "invalid_body", message: "Comando no válido." }, 400);

	return dashboardCommand({
		user: auth.user,
		accessToken: token,
		name,
		arg: typeof body?.arg === "string" ? body.arg : "",
		conversationId: typeof body?.conversationId === "string" && body.conversationId ? body.conversationId : undefined,
	});
};
