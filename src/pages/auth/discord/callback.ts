import type { APIRoute } from "astro";
import { exchangeCodeForToken } from "../../../lib/discord";

export const prerender = false;

export const GET: APIRoute = async ({ url, redirect, cookies }) => {
	const code = url.searchParams.get("code");
	if (!code) return redirect("/");

	const token = await exchangeCodeForToken(code);
	if (!token) return redirect("/");

	const cookieName = process.env.SESSION_COOKIE_NAME || "spa_session";

	cookies.set(
		cookieName,
		JSON.stringify({
			access_token: token.access_token,
			refresh_token: token.refresh_token,
		}),
		{
			httpOnly: true,
			sameSite: "lax",
			secure: process.env.NODE_ENV === "production",
			path: "/",
			maxAge: token.expires_in,
		},
	);

	return redirect("/dashboard");
};
