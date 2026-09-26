import type { APIRoute } from "astro";
import { changelogRepository } from "../../../lib/ChangelogRepository";
import { parseChangelogInput, requireOwner } from "../../../lib/changelog-auth";
import { json } from "../../../lib/session";

export const prerender = false;

function parseId(raw: string | undefined): number | null {
	const id = Number(raw);
	return Number.isInteger(id) && id > 0 ? id : null;
}

export const PUT: APIRoute = async ({ request, cookies, params }) => {
	const denied = await requireOwner(request, cookies);
	if (denied) return denied;

	const id = parseId(params.id);
	if (!id) return json({ error: "ID inválido" }, 400);

	const input = parseChangelogInput(await request.json().catch(() => null));
	if (typeof input === "string") return json({ error: input }, 400);

	const entry = changelogRepository.updateChangelog(id, input);
	if (!entry) return json({ error: "No existe" }, 404);

	return json({ id: entry.id, slug: entry.slug });
};

export const DELETE: APIRoute = async ({ request, cookies, params }) => {
	const denied = await requireOwner(request, cookies);
	if (denied) return denied;

	const id = parseId(params.id);
	if (!id) return json({ error: "ID inválido" }, 400);

	return changelogRepository.deleteChangelog(id) ? json({ ok: true }) : json({ error: "No existe" }, 404);
};
