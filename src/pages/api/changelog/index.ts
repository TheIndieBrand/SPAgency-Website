import type { APIRoute } from "astro";
import { changelogRepository } from "../../../lib/ChangelogRepository";
import { parseChangelogInput, requireOwner } from "../../../lib/changelog-auth";
import { json } from "../../../lib/session";

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
	const denied = await requireOwner(request, cookies);
	if (denied) return denied;

	const input = parseChangelogInput(await request.json().catch(() => null));
	if (typeof input === "string") return json({ error: input }, 400);

	const entry = changelogRepository.createChangelog(input);
	return json({ id: entry.id, slug: entry.slug }, 201);
};
