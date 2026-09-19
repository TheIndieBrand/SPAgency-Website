import type { APIRoute } from "astro";
import { safeNextPath } from "../../../lib/session";

export const prerender = false;

export const GET: APIRoute = ({ redirect, cookies, url }) => {
	// ?next=/support → tras el login se vuelve a esa ruta en vez de ir al dashboard.
	const next = safeNextPath(url.searchParams.get("next"));
	if (next) {
		cookies.set("spa_next", next, {
			httpOnly: true,
			sameSite: "lax",
			secure: process.env.NODE_ENV === "production",
			path: "/",
			maxAge: 600,
		});
	}

	const params = new URLSearchParams({
		client_id: process.env.DISCORD_CLIENT_ID!,
		redirect_uri: process.env.DISCORD_REDIRECT_URI!,
		response_type: "code",
		scope: "identify guilds",
		prompt: "consent",
	});

	return redirect(`https://discord.com/api/oauth2/authorize?${params.toString()}`);
};
