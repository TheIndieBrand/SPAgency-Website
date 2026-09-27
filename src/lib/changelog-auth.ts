import type { AstroCookies } from "astro";
import type { DiscordUser } from "./discord";
import { getSessionUser, json } from "./session";

// only the discord account whose id is in CHANGELOG_OWNER_ID can write. if
// the variable isn't set, nobody is the owner (fails closed).
export function isOwner(user: DiscordUser | null): boolean {
	const ownerId = process.env.CHANGELOG_OWNER_ID;
	return Boolean(user && ownerId && user.id === ownerId);
}

// guard for every write endpoint. checked on the server on every request
// (hiding buttons protects nothing). requiring a json content-type also
// stops csrf: a form on another site can't send that without going through
// cors, which isn't enabled here.
export async function requireOwner(request: Request, cookies: AstroCookies): Promise<Response | null> {
	if (!request.headers.get("content-type")?.includes("application/json")) {
		return json({ error: "Content-Type debe ser application/json" }, 415);
	}

	const user = await getSessionUser(cookies);
	if (!user) return json({ error: "No has iniciado sesión" }, 401);
	if (!isOwner(user)) return json({ error: "No tienes permiso" }, 403);

	return null;
}

const MaxMarkdownLength = 50_000;

export interface ParsedInput {
	markdown: string;
	publishedAt: string;
	published: boolean;
}

// validates the json body for create/edit/preview.
export function parseChangelogInput(body: unknown): ParsedInput | string {
	if (!body || typeof body !== "object") return "Cuerpo inválido";
	const { markdown, publishedAt, published } = body as Record<string, unknown>;

	if (typeof markdown !== "string" || !markdown.trim()) return "El markdown está vacío";
	if (markdown.length > MaxMarkdownLength) return "El markdown es demasiado largo";

	if (typeof publishedAt !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(publishedAt)) return "Fecha inválida";
	if (Number.isNaN(Date.parse(`${publishedAt}T00:00:00Z`))) return "Fecha inválida";

	return { markdown, publishedAt, published: published === true };
}
