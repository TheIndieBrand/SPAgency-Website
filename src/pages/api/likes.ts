import type { APIRoute } from "astro";
import { likesRateLimiter } from "../../lib/LikesRateLimiter";
import { resolveTarget, toggleLike } from "../../lib/likes";
import { json, requireUser } from "../../lib/session";

export const prerender = false;

// Alterna el me gusta del usuario en un target (ver src/lib/likes.ts). Hace falta
// sesión de Discord; nadie puede gustarse a sí mismo (su propio testimonio).
export const POST: APIRoute = async ({ request, cookies }) => {
	const auth = await requireUser(request, cookies);
	if ("response" in auth) return auth.response;

	if (likesRateLimiter.isRateLimited(auth.user.id)) return json({ error: "rate_limited", message: "Vas demasiado rápido." }, 429);

	const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
	const target = typeof body?.target === "string" ? body.target : "";

	const resolved = resolveTarget(target);
	if (!resolved) return json({ error: "invalid_target", message: "No se puede dar me gusta a eso." }, 400);
	if (resolved.ownerId === auth.user.id) {
		return json({ error: "own_target", message: "No puedes dar me gusta a tu propio comentario." }, 403);
	}

	return json(toggleLike(target, auth.user.id));
};
