import type { APIRoute } from "astro";
import { createChangelog } from "../../../lib/changelog";
import { json, parseChangelogInput, requireOwner } from "../../../lib/changelog-auth";

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
	const denied = await requireOwner(request, cookies);
	if (denied) return denied;

	const input = parseChangelogInput(await request.json().catch(() => null));
	if (typeof input === "string") return json({ error: input }, 400);

	const entry = createChangelog(input);
	return json({ id: entry.id, slug: entry.slug }, 201);
};
