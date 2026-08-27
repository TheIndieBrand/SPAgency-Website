import type { APIRoute } from "astro";

export const prerender = false;

export const GET: APIRoute = ({ redirect }) => {
	const params = new URLSearchParams({
		client_id: process.env.DISCORD_CLIENT_ID!,
		redirect_uri: process.env.DISCORD_REDIRECT_URI!,
		response_type: "code",
		scope: "identify guilds",
		prompt: "consent",
	});

	return redirect(`https://discord.com/api/oauth2/authorize?${params.toString()}`);
};
