import type { APIRoute } from "astro";
import { json, requireUser } from "../../../../../lib/session";
import { botFailure, closeTicket } from "../../../../../lib/support-bot";

export const prerender = false;

// the user closes their ticket. the bot responds as soon as closing starts;
// the transcript arrives later via /api/support/transcripts, and once it's
// stored the bot deletes the channel (message queries then start returning 404).
export const POST: APIRoute = async ({ request, cookies, params }) => {
	const auth = await requireUser(request, cookies);
	if ("response" in auth) return auth.response;

	const result = await closeTicket(params.id ?? "", auth.user.id);
	return result.ok ? json({ closing: true }, 202) : botFailure(result);
};
