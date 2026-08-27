import type { APIRoute } from "astro";

export const prerender = false;

export const GET: APIRoute = ({ cookies, redirect }) => {
	const cookieName = process.env.SESSION_COOKIE_NAME || "spa_session";
	cookies.delete(cookieName, { path: "/" });
	return redirect("/");
};
