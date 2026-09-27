import type { AstroCookies, AstroGlobal } from "astro";
import { createHash } from "node:crypto";
import { getBotGuildIds, getUserGuilds, hasAdminAccess, type DiscordGuild } from "./discord";
import { getSessionUser, json } from "./session";
import { sessionCookieService } from "./SessionCookieService";

// who can touch a guild: an administrator of it on discord, with SP Agency
// inside. that's two discord calls, and the dashboard repeats them on every
// page and every setting it autosaves, so they're cached for a minute. cost: a
// permission revoked on discord can still be valid for up to that minute.
// the other way around there's no wait: if the cache says "no access", discord
// is asked again (at least 3s apart), so someone who just got permissions or
// just invited the bot doesn't have to wait.

const TtlMs = 60_000;
const RefreshAfterMs = 3_000;
const MaxEntries = 500;

interface Cached<T> {
	value: T;
	at: number;
}

/**
 * caches, per access token, which guilds a user can manage and which guilds
 * the bot is in — the two discord calls behind every guild access check.
 */
class GuildAccessCache {
	private readonly guildsByToken = new Map<string, Cached<DiscordGuild[]>>();
	private readonly pendingGuilds = new Map<string, Promise<Cached<DiscordGuild[]> | null>>();
	private botGuilds: Cached<Set<string>> | null = null;
	private pendingBot: Promise<Cached<Set<string>>> | null = null;

	private keyOf(token: string): string {
		return createHash("sha256").update(token).digest("hex");
	}

	async userGuilds(token: string, fresh = false): Promise<Cached<DiscordGuild[]> | null> {
		const key = this.keyOf(token);
		const hit = this.guildsByToken.get(key);
		if (hit && !fresh && Date.now() - hit.at < TtlMs) return hit;

		// several requests for the same user at once share a single call.
		const pending = this.pendingGuilds.get(key);
		if (pending) return pending;

		const request = getUserGuilds(token)
			.then((guilds) => {
				if (!guilds) return null; // discord rejected the token: the session is no longer valid
				if (this.guildsByToken.size >= MaxEntries) this.guildsByToken.clear();
				const entry = { value: guilds, at: Date.now() };
				this.guildsByToken.set(key, entry);
				return entry;
			})
			.finally(() => this.pendingGuilds.delete(key));

		this.pendingGuilds.set(key, request);
		return request;
	}

	async botGuildIds(fresh = false): Promise<Cached<Set<string>>> {
		if (this.botGuilds && !fresh && Date.now() - this.botGuilds.at < TtlMs) return this.botGuilds;
		this.pendingBot ??= getBotGuildIds()
			.then((ids) => (this.botGuilds = { value: ids, at: Date.now() }))
			.finally(() => (this.pendingBot = null));
		return this.pendingBot;
	}
}

const guildAccessCache = new GuildAccessCache();

// guilds the user can manage (administrator, with the bot inside), from the
// same cache as everything else. null if discord rejects the session.
export async function listAccessibleGuilds(accessToken: string): Promise<DiscordGuild[] | null> {
	const guilds = await guildAccessCache.userGuilds(accessToken);
	if (!guilds) return null;
	const bots = await guildAccessCache.botGuildIds();
	return guilds.value.filter((g) => hasAdminAccess(g) && bots.value.has(g.id)).sort((a, b) => a.name.localeCompare(b.name));
}

export type AccessResult = { guild: DiscordGuild } | { error: "unauthorized" | "forbidden" };

export async function resolveGuildAccess(accessToken: string, guildId: string | undefined): Promise<AccessResult> {
	let guilds = await guildAccessCache.userGuilds(accessToken);
	if (!guilds) return { error: "unauthorized" };

	let guild = guilds.value.find((g) => g.id === guildId);
	if ((!guild || !hasAdminAccess(guild)) && Date.now() - guilds.at > RefreshAfterMs) {
		guilds = (await guildAccessCache.userGuilds(accessToken, true)) ?? guilds;
		guild = guilds.value.find((g) => g.id === guildId);
	}
	if (!guild || !hasAdminAccess(guild)) return { error: "forbidden" };

	let bots = await guildAccessCache.botGuildIds();
	if (!bots.value.has(guild.id) && Date.now() - bots.at > RefreshAfterMs) bots = await guildAccessCache.botGuildIds(true);
	if (!bots.value.has(guild.id)) return { error: "forbidden" };

	return { guild };
}

export function tokenFromCookies(cookies: AstroCookies): { cookieName: string; token: string | null } {
	return { cookieName: sessionCookieService.name, token: sessionCookieService.readAccessToken(cookies) };
}

type GuardResult = { guild: DiscordGuild } | { redirect: Response };

// guard for every guild page: validates the session, confirms the user is an
// administrator of `guildId` and that the bot is in it (otherwise there's
// nothing to manage). the caller just `return`s the redirect as-is.
export async function requireGuildAccess(Astro: AstroGlobal, guildId: string | undefined): Promise<GuardResult> {
	const token = sessionCookieService.readAccessToken(Astro.cookies);
	if (!token) {
		if (sessionCookieService.has(Astro.cookies)) sessionCookieService.clear(Astro.cookies);
		return { redirect: Astro.redirect("/auth/discord/login") };
	}

	const access = await resolveGuildAccess(token, guildId);
	if ("guild" in access) return { guild: access.guild };

	if (access.error === "unauthorized") {
		sessionCookieService.clear(Astro.cookies);
		return { redirect: Astro.redirect("/auth/discord/login") };
	}
	return { redirect: Astro.redirect("/dashboard") };
}

// the same check for endpoints (they answer json instead of redirecting).
// requests that write require a json content-type: a form on another site
// can't send that without going through cors (disabled here), which is what
// stops csrf.
export async function requireGuildApi(
	request: Request,
	cookies: AstroCookies,
	guildId: string | undefined,
): Promise<{ guild: DiscordGuild; userId: string } | { response: Response }> {
	if (request.method !== "GET" && !request.headers.get("content-type")?.includes("application/json")) {
		return { response: json({ error: "unsupported_media_type", message: "Petición no válida." }, 415) };
	}

	const token = sessionCookieService.readAccessToken(cookies);
	if (!token) return { response: json({ error: "unauthorized", message: "Inicia sesión para continuar." }, 401) };

	const access = await resolveGuildAccess(token, guildId);
	if ("error" in access) {
		return access.error === "unauthorized"
			? { response: json({ error: "unauthorized", message: "Tu sesión ha caducado. Vuelve a iniciar sesión." }, 401) }
			: { response: json({ error: "forbidden", message: "No tienes acceso a este servidor." }, 403) };
	}

	const user = await getSessionUser(cookies);
	if (!user) return { response: json({ error: "unauthorized", message: "Tu sesión ha caducado. Vuelve a iniciar sesión." }, 401) };

	return { guild: access.guild, userId: user.id };
}
