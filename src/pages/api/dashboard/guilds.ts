import type { APIRoute } from "astro";
import { guildDashboardService } from "../../../lib/GuildDashboardService";
import { json } from "../../../lib/session";
import { sessionCookieService } from "../../../lib/SessionCookieService";

export const prerender = false;

// Servidores donde el usuario es administrador y si SP Agency está en ellos. Es
// lo único lento del dashboard (dos llamadas a Discord), así que la página se
// pinta primero y pide esto aparte, mientras muestra tarjetas de carga.
export const GET: APIRoute = async ({ cookies }) => {
	const accessToken = sessionCookieService.readAccessToken(cookies);
	if (!accessToken) return json({ error: "unauthorized" }, 401);

	const result = await guildDashboardService.listGuildCards(accessToken);
	if (!result.ok) {
		if (result.reason === "unauthorized") {
			sessionCookieService.clear(cookies);
			return json({ error: "unauthorized" }, 401);
		}
		return json({ error: "discord_unavailable" }, 502);
	}

	const response = json({ guilds: result.guilds });
	response.headers.set("Cache-Control", "no-store");
	return response;
};
