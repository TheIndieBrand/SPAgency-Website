import type { APIRoute } from "astro";
import { botInviteUrl, getBotGuildIds, getUserGuilds, guildIconUrl, hasAdminAccess } from "../../../lib/discord";
import { json } from "../../../lib/session";

export const prerender = false;

// Servidores donde el usuario es administrador y si SP Agency está en ellos. Es
// lo único lento del dashboard (dos llamadas a Discord), así que la página se
// pinta primero y pide esto aparte, mientras muestra tarjetas de carga.
export const GET: APIRoute = async ({ cookies }) => {
	const cookieName = process.env.SESSION_COOKIE_NAME || "spa_session";
	const raw = cookies.get(cookieName)?.value;

	let accessToken: string | undefined;
	try {
		accessToken = raw ? JSON.parse(raw)?.access_token : undefined;
	} catch {
		accessToken = undefined;
	}
	if (!accessToken) return json({ error: "unauthorized" }, 401);

	try {
		const [userGuilds, botGuildIds] = await Promise.all([getUserGuilds(accessToken), getBotGuildIds()]);

		// Discord rechazó el token: la sesión ya no vale.
		if (!userGuilds) {
			cookies.delete(cookieName, { path: "/" });
			return json({ error: "unauthorized" }, 401);
		}

		const guilds = userGuilds
			.filter(hasAdminAccess)
			.map((guild) => {
				const isProtected = botGuildIds.has(guild.id);
				return {
					id: guild.id,
					name: guild.name,
					icon: guildIconUrl(guild),
					members: guild.approximate_member_count ?? null,
					protected: isProtected,
					inviteUrl: isProtected ? null : botInviteUrl(guild.id),
				};
			})
			.sort((a, b) => a.name.localeCompare(b.name));

		const response = json({ guilds });
		response.headers.set("Cache-Control", "no-store");
		return response;
	} catch {
		// Discord no responde: no es un problema de sesión, se puede reintentar.
		return json({ error: "discord_unavailable" }, 502);
	}
};
