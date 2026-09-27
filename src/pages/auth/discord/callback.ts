import type { APIRoute } from "astro";
import { exchangeCodeForToken } from "../../../lib/discord";
import { safeNextPath } from "../../../lib/session";
import { sessionCookieService } from "../../../lib/SessionCookieService";

export const prerender = false;

export const GET: APIRoute = async ({ url, redirect, cookies }) => {
	const code = url.searchParams.get("code");
	if (!code) return redirect("/");

	const token = await exchangeCodeForToken(code);
	if (!token) return redirect("/");

	sessionCookieService.set(cookies, {
		accessToken: token.access_token,
		refreshToken: token.refresh_token,
		expiresIn: token.expires_in,
	});

	// if the login came from another page (e.g. /support), go back to it.
	const next = safeNextPath(cookies.get("spa_next")?.value);
	cookies.delete("spa_next", { path: "/" });

	return redirect(next ?? "/dashboard");
};
