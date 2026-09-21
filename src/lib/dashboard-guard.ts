import type { AstroCookies, AstroGlobal } from "astro";
import { createHash } from "node:crypto";
import { getBotGuildIds, getUserGuilds, hasAdminAccess, type DiscordGuild } from "./discord";
import { getSessionUser, json } from "./session";

// Quién puede tocar un servidor: administrador de él en Discord y con SP Agency
// dentro. Son dos llamadas a Discord, y el dashboard las repite en cada página y
// en cada ajuste que se autoguarda, así que se recuerdan un minuto. Coste: un
// permiso retirado en Discord puede seguir valiendo hasta ese minuto. Al revés no
// hay espera: si la caché dice "no tienes acceso" se vuelve a preguntar a
// Discord (con un mínimo de 3 s entre preguntas), para que quien acaba de recibir
// permisos o de invitar al bot no tenga que esperar.

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
// misma caché que el resto. Null si Discord rechaza la sesión.
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
	const cookieName = process.env.SESSION_COOKIE_NAME || "spa_session";
	const raw = cookies.get(cookieName)?.value;
	if (!raw) return { cookieName, token: null };
	try {
		const token = JSON.parse(raw)?.access_token;
		return { cookieName, token: typeof token === "string" ? token : null };
	} catch {
		return { cookieName, token: null };
	}
}

type GuardResult = { guild: DiscordGuild } | { redirect: Response };

// Guardia de cada página de un servidor: valida la sesión, confirma que el usuario
// es administrador de `guildId` y que el bot está en él (si no, no hay nada que
// gestionar). Quien llama hace `return` de la redirección tal cual.
export async function requireGuildAccess(Astro: AstroGlobal, guildId: string | undefined): Promise<GuardResult> {
	const { cookieName, token } = tokenFromCookies(Astro.cookies);
	if (!token) {
		if (Astro.cookies.has(cookieName)) Astro.cookies.delete(cookieName, { path: "/" });
		return { redirect: Astro.redirect("/auth/discord/login") };
	}

	const access = await resolveGuildAccess(token, guildId);
	if ("guild" in access) return { guild: access.guild };

	if (access.error === "unauthorized") {
		Astro.cookies.delete(cookieName, { path: "/" });
		return { redirect: Astro.redirect("/auth/discord/login") };
	}
	return { redirect: Astro.redirect("/dashboard") };
}

// La misma comprobación para los endpoints (responden JSON en vez de redirigir).
// Las peticiones que escriben exigen Content-Type JSON: un formulario de otra web
// no puede enviarlo así sin pasar por CORS (aquí deshabilitado), lo que evita el CSRF.
export async function requireGuildApi(
	request: Request,
	cookies: AstroCookies,
	guildId: string | undefined,
): Promise<{ guild: DiscordGuild; userId: string } | { response: Response }> {
	if (request.method !== "GET" && !request.headers.get("content-type")?.includes("application/json")) {
		return { response: json({ error: "unsupported_media_type", message: "Petición no válida." }, 415) };
	}

	const { token } = tokenFromCookies(cookies);
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
