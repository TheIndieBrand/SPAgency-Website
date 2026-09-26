import type { APIRoute } from "astro";
import { likesRateLimiter } from "../../lib/LikesRateLimiter";
import { likesRepository } from "../../lib/LikesRepository";
import { json, requireUser } from "../../lib/session";

export const prerender = false;

// toggles the user's like on a target (see src/lib/LikesRepository.ts).
// requires a discord session; nobody can like their own thing (their own testimonial).
export const POST: APIRoute = async ({ request, cookies }) => {
	const auth = await requireUser(request, cookies);
	if ("response" in auth) return auth.response;

	if (likesRateLimiter.isRateLimited(auth.user.id)) return json({ error: "rate_limited", message: "Vas demasiado rápido." }, 429);

	const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
	const target = typeof body?.target === "string" ? body.target : "";

	const resolved = likesRepository.resolveTarget(target);
	if (!resolved) return json({ error: "invalid_target", message: "No se puede dar me gusta a eso." }, 400);
	if (resolved.ownerId === auth.user.id) {
		return json({ error: "own_target", message: "No puedes dar me gusta a tu propio comentario." }, 403);
	}

	return json(likesRepository.toggleLike(target, auth.user.id));
};
