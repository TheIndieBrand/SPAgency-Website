import type { APIRoute } from "astro";
import { sessionCookieService } from "../../lib/SessionCookieService";

export const prerender = false;

export const GET: APIRoute = ({ cookies, redirect }) => {
	sessionCookieService.clear(cookies);
	return redirect("/");
};
