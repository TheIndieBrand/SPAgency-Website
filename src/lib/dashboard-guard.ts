import type { AstroGlobal } from "astro";
import { getUserGuilds, getBotGuildIds, hasAdminAccess, type DiscordGuild } from "./discord";

type GuardResult = { guild: DiscordGuild } | { redirect: Response };

// Shared session/access check for every per-guild dashboard page: validates
// the session cookie, confirms the user is an admin of `guildId`, and
// confirms the bot is actually in that guild — otherwise there's nothing to
// manage, so callers just `return` the redirect Response as-is.
export async function requireGuildAccess(Astro: AstroGlobal, guildId: string | undefined): Promise<GuardResult> {
	const cookieName = process.env.SESSION_COOKIE_NAME || "spa_session";
	const raw = Astro.cookies.get(cookieName)?.value;

	if (!raw) return { redirect: Astro.redirect("/auth/discord/login") };

	let session: { access_token: string } | null = null;
	try {
		session = JSON.parse(raw);
	} catch {
		session = null;
	}

	if (!session) {
		Astro.cookies.delete(cookieName, { path: "/" });
		return { redirect: Astro.redirect("/auth/discord/login") };
	}

	const [userGuilds, botGuildIds] = await Promise.all([getUserGuilds(session.access_token), getBotGuildIds()]);

	if (!userGuilds) {
		Astro.cookies.delete(cookieName, { path: "/" });
		return { redirect: Astro.redirect("/auth/discord/login") };
	}

	const guild = userGuilds.find((g) => g.id === guildId);

	if (!guild || !hasAdminAccess(guild) || !botGuildIds.has(guild.id)) {
		return { redirect: Astro.redirect("/dashboard") };
	}

	return { guild };
}
