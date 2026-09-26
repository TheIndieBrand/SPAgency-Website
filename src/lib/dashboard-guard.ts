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

const TTL_MS = 60_000;
const REFRESH_AFTER_MS = 3_000;
const MAX_ENTRIES = 500;

interface Cached<T> {
	value: T;
	at: number;
}

const guildsByToken = new Map<string, Cached<DiscordGuild[]>>();
const pendingGuilds = new Map<string, Promise<Cached<DiscordGuild[]> | null>>();
let botGuilds: Cached<Set<string>> | null = null;
let pendingBot: Promise<Cached<Set<string>>> | null = null;

const keyOf = (token: string) => createHash("sha256").update(token).digest("hex");

async function userGuilds(token: string, fresh = false): Promise<Cached<DiscordGuild[]> | null> {
	const key = keyOf(token);
	const hit = guildsByToken.get(key);
	if (hit && !fresh && Date.now() - hit.at < TTL_MS) return hit;

	// Varias peticiones a la vez del mismo usuario comparten una sola llamada.
	const pending = pendingGuilds.get(key);
	if (pending) return pending;

	const request = getUserGuilds(token)
		.then((guilds) => {
			if (!guilds) return null; // Discord rechazó el token: la sesión ya no vale
			if (guildsByToken.size >= MAX_ENTRIES) guildsByToken.clear();
			const entry = { value: guilds, at: Date.now() };
			guildsByToken.set(key, entry);
			return entry;
		})
		.finally(() => pendingGuilds.delete(key));

	pendingGuilds.set(key, request);
	return request;
}

async function botGuildIds(fresh = false): Promise<Cached<Set<string>>> {
	if (botGuilds && !fresh && Date.now() - botGuilds.at < TTL_MS) return botGuilds;
	pendingBot ??= getBotGuildIds()
		.then((ids) => (botGuilds = { value: ids, at: Date.now() }))
		.finally(() => (pendingBot = null));
	return pendingBot;
}

// Servidores que el usuario puede gestionar (administrador y con el bot dentro), con la
// same cache as everything else. null if discord rejects the session.
export async function listAccessibleGuilds(accessToken: string): Promise<DiscordGuild[] | null> {
	const guilds = await userGuilds(accessToken);
	if (!guilds) return null;
	const bots = await botGuildIds();
	return guilds.value.filter((g) => hasAdminAccess(g) && bots.value.has(g.id)).sort((a, b) => a.name.localeCompare(b.name));
}

export type AccessResult = { guild: DiscordGuild } | { error: "unauthorized" | "forbidden" };

export async function resolveGuildAccess(accessToken: string, guildId: string | undefined): Promise<AccessResult> {
	let guilds = await userGuilds(accessToken);
	if (!guilds) return { error: "unauthorized" };

	let guild = guilds.value.find((g) => g.id === guildId);
	if ((!guild || !hasAdminAccess(guild)) && Date.now() - guilds.at > REFRESH_AFTER_MS) {
		guilds = (await userGuilds(accessToken, true)) ?? guilds;
		guild = guilds.value.find((g) => g.id === guildId);
	}
	if (!guild || !hasAdminAccess(guild)) return { error: "forbidden" };

	let bots = await botGuildIds();
	if (!bots.value.has(guild.id) && Date.now() - bots.at > REFRESH_AFTER_MS) bots = await botGuildIds(true);
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
