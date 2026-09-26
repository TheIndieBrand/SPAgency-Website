import type { AstroCookies } from "astro";
import { createHash } from "node:crypto";
import { getCurrentUser, type DiscordUser } from "./discord";
import { sessionCookieService } from "./SessionCookieService";

// the session cookie only stores discord's tokens, so knowing who the user is
// costs a call to /users/@me. the support chat polls every few seconds:
// without a cache, every poll would also be a discord call (with its latency
// and its rate limits). the identity is remembered for a while, per token.
//
// only in the process's own memory, and keyed by a hash. cost: a token
// revoked on discord can still be valid for up to USER_TTL_MS. failures
// (an invalid token) are remembered for less time, so a bad token doesn't
// hammer discord while still recovering quickly.
const USER_TTL_MS = 60_000;
const MISS_TTL_MS = 10_000;
const MAX_ENTRIES = 500;

const identityCache = new Map<string, { user: DiscordUser | null; expires: number }>();
const inFlight = new Map<string, Promise<DiscordUser | null>>();

function lookupUser(accessToken: string): Promise<DiscordUser | null> {
	const key = createHash("sha256").update(accessToken).digest("hex");

	const cached = identityCache.get(key);
	if (cached && cached.expires > Date.now()) return Promise.resolve(cached.user);

	// Varias peticiones a la vez del mismo usuario comparten una sola llamada.
	const pending = inFlight.get(key);
	if (pending) return pending;

	const request = getCurrentUser(accessToken)
		.then((user) => {
			if (identityCache.size >= MAX_ENTRIES) {
				const now = Date.now();
				for (const [k, v] of identityCache) if (v.expires <= now) identityCache.delete(k);
				if (identityCache.size >= MAX_ENTRIES) identityCache.clear();
			}
			identityCache.set(key, { user, expires: Date.now() + (user ? USER_TTL_MS : MISS_TTL_MS) });
			return user;
		})
		// Un fallo de red no es una respuesta de Discord: no se cachea.
		.catch(() => null)
		.finally(() => inFlight.delete(key));

	inFlight.set(key, request);
	return request;
}

// reuses the session from the discord login (cookie with the access_token).
// doesn't delete the cookie on failure: these checks are also used on public
// pages, where having no session is the normal case.
export async function getSessionUser(cookies: AstroCookies): Promise<DiscordUser | null> {
	const accessToken = sessionCookieService.readAccessToken(cookies);
	return accessToken ? lookupUser(accessToken) : null;
}

export function json(data: unknown, status = 200): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

// guard for endpoints that need a session. requests that write require a
// json content-type: a form on another site can't send that without going
// through cors (not enabled here), which is what stops csrf.
export async function requireUser(
	request: Request,
	cookies: AstroCookies,
): Promise<{ user: DiscordUser } | { response: Response }> {
	if (request.method !== "GET" && !request.headers.get("content-type")?.includes("application/json")) {
		return { response: json({ error: "unsupported_media_type", message: "Petición no válida." }, 415) };
	}

	const user = await getSessionUser(cookies);
	if (!user) {
		return { response: json({ error: "unauthorized", message: "Inicia sesión para continuar." }, 401) };
	}

	return { user };
}

// Ruta interna a la que volver tras el login (?next=/support). Solo rutas
// relativas del propio sitio: nada de "//otro.com" ni "\" (open redirect).
export function safeNextPath(value: string | null | undefined): string | null {
	if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
	return /^\/[\w\-./%?=&]*$/.test(value) ? value : null;
}
