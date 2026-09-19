import type { AstroCookies } from "astro";
import type { DiscordUser } from "./discord";
import { getSessionUser, json } from "./session";

// Solo la cuenta de Discord cuyo ID está en CHANGELOG_OWNER_ID puede escribir.
// Si la variable no está definida nadie es dueño (falla cerrado).
export function isOwner(user: DiscordUser | null): boolean {
	const ownerId = process.env.CHANGELOG_OWNER_ID;
	return Boolean(user && ownerId && user.id === ownerId);
}

// Guardia de todos los endpoints de escritura. Se comprueba en el servidor en
// cada petición (esconder botones no protege nada). Exigir Content-Type JSON
// evita además el CSRF: un formulario de otra web no puede enviarlo así sin
// pasar por CORS, que aquí no está habilitado.
export async function requireOwner(request: Request, cookies: AstroCookies): Promise<Response | null> {
	if (!request.headers.get("content-type")?.includes("application/json")) {
		return json({ error: "Content-Type debe ser application/json" }, 415);
	}

	const user = await getSessionUser(cookies);
	if (!user) return json({ error: "No has iniciado sesión" }, 401);
	if (!isOwner(user)) return json({ error: "No tienes permiso" }, 403);

	return null;
}

const MAX_MARKDOWN = 50_000;

export interface ParsedInput {
	markdown: string;
	publishedAt: string;
	published: boolean;
}

// Valida el cuerpo JSON de crear/editar/previsualizar.
export function parseChangelogInput(body: unknown): ParsedInput | string {
	if (!body || typeof body !== "object") return "Cuerpo inválido";
	const { markdown, publishedAt, published } = body as Record<string, unknown>;

	if (typeof markdown !== "string" || !markdown.trim()) return "El markdown está vacío";
	if (markdown.length > MAX_MARKDOWN) return "El markdown es demasiado largo";

	if (typeof publishedAt !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(publishedAt)) return "Fecha inválida";
	if (Number.isNaN(Date.parse(`${publishedAt}T00:00:00Z`))) return "Fecha inválida";

	return { markdown, publishedAt, published: published === true };
}
