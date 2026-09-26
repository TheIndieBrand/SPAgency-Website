import type { APIRoute } from "astro";
import { usageReport } from "../../../lib/chat/usage";
import { json, requireUser } from "../../../lib/session";

export const prerender = false;

// /usage command: the detailed usage of whoever asks. doesn't call the
// model, so it costs nothing (and doesn't require having accepted the notice: it's just their own data).
export const GET: APIRoute = async ({ request, cookies }) => {
	const auth = await requireUser(request, cookies);
	if ("response" in auth) return auth.response;

	return json(usageReport(auth.user.id));
};
