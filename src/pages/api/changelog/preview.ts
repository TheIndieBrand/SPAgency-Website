import type { APIRoute } from "astro";
import { formatChangelogDate } from "../../../lib/ChangelogRepository";
import { parseChangelogInput, requireOwner } from "../../../lib/changelog-auth";
import { json } from "../../../lib/session";
import { renderMarkdown } from "../../../lib/changelog-markdown";

export const prerender = false;

// Vista previa del editor: mismo render (y mismo saneado) que la página
// pública, así lo que ves al escribir es exactamente lo que se publicará.
export const POST: APIRoute = async ({ request, cookies }) => {
	const denied = await requireOwner(request, cookies);
	if (denied) return denied;

	const input = parseChangelogInput(await request.json().catch(() => null));
	if (typeof input === "string") return json({ error: input }, 400);

	const { title, name, version, subtitle, html } = renderMarkdown(input.markdown);
	return json({ title, name, version, subtitle, html, date: formatChangelogDate(input.publishedAt) });
};
