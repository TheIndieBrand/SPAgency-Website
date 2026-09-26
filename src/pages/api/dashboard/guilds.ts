import type { APIRoute } from "astro";
import { botInviteUrl, getBotGuildIds, getUserGuilds, guildIconUrl, hasAdminAccess } from "../../../lib/discord";
import { MODULES_TOTAL, overviewRepository } from "../../../lib/db/OverviewRepository";
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

		const admin = userGuilds.filter(hasAdminAccess);
		// Cifras de las tarjetas: una consulta para todos los servidores con el bot. Si la base
		// no responde, las tarjetas quedan sin cifras (no se inventan).
		const stats = await overviewRepository.getGuildCardStats(admin.filter((g) => botGuildIds.has(g.id)).map((g) => g.id));

		const guilds = admin
			.map((guild) => {
				const isProtected = botGuildIds.has(guild.id);
				const own = stats?.get(guild.id);
				return {
					id: guild.id,
					name: guild.name,
					icon: guildIconUrl(guild),
					members: guild.approximate_member_count ?? null,
					protected: isProtected,
					inviteUrl: isProtected ? null : botInviteUrl(guild.id),
					stats: own ? { ...own, modulesTotal: MODULES_TOTAL } : null,
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
