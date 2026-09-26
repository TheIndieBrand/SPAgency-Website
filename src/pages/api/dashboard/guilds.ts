import type { APIRoute } from "astro";
import { guildDashboardService } from "../../../lib/GuildDashboardService";
import { json } from "../../../lib/session";
import { sessionCookieService } from "../../../lib/SessionCookieService";

export const prerender = false;

// guilds the user administers, and whether SP Agency is in each one. this is
// the only slow part of the dashboard (two discord calls), so the page paints
// first and requests this separately, showing loading cards meanwhile.
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
