import type { AstroCookies } from "astro";
import { createHash } from "node:crypto";
import { getCurrentUser, type DiscordUser } from "./discord";
import { sessionCookieService } from "./SessionCookieService";

const UserTtlMs = 60_000;
const MissTtlMs = 10_000;
const MaxEntries = 500;

/**
 * caches a discord user's identity by access token, so knowing who a
 * session belongs to doesn't cost a discord call on every request.
 *
 * the session cookie only stores discord's tokens, so knowing who the user is
 * costs a call to /users/@me. the support chat polls every few seconds:
 * without a cache, every poll would also be a discord call (with its latency
 * and its rate limits). the identity is remembered for a while, per token.
 *
 * only in the process's own memory, and keyed by a hash. cost: a token
 * revoked on discord can still be valid for up to UserTtlMs. failures
 * (an invalid token) are remembered for less time, so a bad token doesn't
 * hammer discord while still recovering quickly.
 */
class DiscordIdentityCache {
	private readonly entries = new Map<string, { user: DiscordUser | null; expires: number }>();
	private readonly inFlight = new Map<string, Promise<DiscordUser | null>>();

	lookupUser(accessToken: string): Promise<DiscordUser | null> {
		const key = createHash("sha256").update(accessToken).digest("hex");

		const cached = this.entries.get(key);
		if (cached && cached.expires > Date.now()) return Promise.resolve(cached.user);

		// several requests for the same user at once share a single call.
		const pending = this.inFlight.get(key);
		if (pending) return pending;

		const request = getCurrentUser(accessToken)
			.then((user) => {
				if (this.entries.size >= MaxEntries) {
					const now = Date.now();
					for (const [k, v] of this.entries) if (v.expires <= now) this.entries.delete(k);
					if (this.entries.size >= MaxEntries) this.entries.clear();
				}
				this.entries.set(key, { user, expires: Date.now() + (user ? UserTtlMs : MissTtlMs) });
				return user;
			})
			// a network failure isn't a response from discord: it isn't cached.
			.catch(() => null)
			.finally(() => this.inFlight.delete(key));

		this.inFlight.set(key, request);
		return request;
	}
}

const discordIdentityCache = new DiscordIdentityCache();

// reuses the session from the discord login (cookie with the access_token).
// doesn't delete the cookie on failure: these checks are also used on public
// pages, where having no session is the normal case.
export async function getSessionUser(cookies: AstroCookies): Promise<DiscordUser | null> {
	const accessToken = sessionCookieService.readAccessToken(cookies);
	return accessToken ? discordIdentityCache.lookupUser(accessToken) : null;
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

// internal route to return to after login (?next=/support). only routes
// relative to the site itself: nothing like "//other.com" or "\" (open redirect).
export function safeNextPath(value: string | null | undefined): string | null {
	if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
	return /^\/[\w\-./%?=&]*$/.test(value) ? value : null;
}
