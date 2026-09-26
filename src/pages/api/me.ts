import type { APIRoute } from "astro";
import { userAvatarUrl } from "../../lib/discord";
import { getSessionUser, json } from "../../lib/session";

export const prerender = false;

// who's signed in, for the navbar's account section. public pages (home,
// docs) are rendered without a session, so the navbar asks this on load.
// no session isn't an error: it responds { user: null }. never cached.
export const GET: APIRoute = async ({ cookies }) => {
	const user = await getSessionUser(cookies);
	const response = json({
		user: user
			? { id: user.id, name: user.global_name || user.username, username: user.username, avatar: userAvatarUrl(user) }
			: null,
	});
	response.headers.set("Cache-Control", "no-store");
	return response;
};
