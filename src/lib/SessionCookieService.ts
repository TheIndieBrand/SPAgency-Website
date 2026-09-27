import type { AstroCookies } from "astro";

// the cookie that stores the discord oauth tokens after login. its name and shape used to be
// re-read by hand in five different files — this class is now the one place that knows them.

export interface SessionTokens {
	accessToken: string;
	refreshToken: string;
	expiresIn: number;
}

/**
 * reads, writes and clears the discord session cookie shared across the site.
 */
export class SessionCookieService {
	/** the cookie's name, from `SESSION_COOKIE_NAME` or the default. */
	readonly name: string = process.env.SESSION_COOKIE_NAME || "spa_session";

	/**
	 * whether the request carries a session cookie at all, valid or not.
	 * @param cookies - the request's cookie jar.
	 */
	has(cookies: AstroCookies): boolean {
		return cookies.has(this.name);
	}

	/**
	 * reads the discord access token out of the session cookie.
	 * @param cookies - the request's cookie jar.
	 * @returns the access token, or null if there is no valid session.
	 */
	readAccessToken(cookies: AstroCookies): string | null {
		const raw = cookies.get(this.name)?.value;
		if (!raw) return null;
		try {
			const token = JSON.parse(raw)?.access_token;
			return typeof token === "string" ? token : null;
		} catch {
			return null;
		}
	}

	/**
	 * writes the session cookie after a successful discord login.
	 * @param cookies - the request's cookie jar.
	 * @param tokens - the tokens to store, and how long they last.
	 */
	set(cookies: AstroCookies, tokens: SessionTokens): void {
		cookies.set(this.name, JSON.stringify({ access_token: tokens.accessToken, refresh_token: tokens.refreshToken }), {
			httpOnly: true,
			sameSite: "lax",
			secure: process.env.NODE_ENV === "production",
			path: "/",
			maxAge: tokens.expiresIn,
		});
	}

	/**
	 * removes the session cookie, e.g. on logout or when discord no longer accepts the token.
	 * @param cookies - the request's cookie jar.
	 */
	clear(cookies: AstroCookies): void {
		cookies.delete(this.name, { path: "/" });
	}
}

export const sessionCookieService = new SessionCookieService();
