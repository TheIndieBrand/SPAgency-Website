import type { APIRoute } from "astro";
import { formatChangelogDate } from "../../../lib/ChangelogRepository";
import { parseChangelogInput, requireOwner } from "../../../lib/changelog-auth";
import { json } from "../../../lib/session";
import { renderMarkdown } from "../../../lib/changelog-markdown";

export const prerender = false;

// editor preview: same render (and same sanitizing) as the public page, so
// what you see while writing is exactly what gets published.
export const POST: APIRoute = async ({ request, cookies }) => {
	const denied = await requireOwner(request, cookies);
	if (denied) return denied;

	const input = parseChangelogInput(await request.json().catch(() => null));
	if (typeof input === "string") return json({ error: input }, 400);

	const { title, name, version, subtitle, html } = renderMarkdown(input.markdown);
	return json({ title, name, version, subtitle, html, date: formatChangelogDate(input.publishedAt) });
};
