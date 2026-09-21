import type { APIRoute } from "astro";
import { resolveTarget, toggleLike } from "../../lib/likes";
import { json, requireUser } from "../../lib/session";

export const prerender = false;

// Freno anti-abuso: alternar me gusta en bucle no debe ser gratis. Ventana
// deslizante en memoria (por usuario): como mucho 20 cambios cada 10 s.
const WINDOW_MS = 10_000;
const MAX_TOGGLES = 20;
const recent = new Map<string, number[]>();

function rateLimited(userId: string): boolean {
	const now = Date.now();
	const hits = (recent.get(userId) ?? []).filter((t) => now - t < WINDOW_MS);
	hits.push(now);
	recent.set(userId, hits);

	// Sin acumular usuarios inactivos para siempre.
	if (recent.size > 5000) for (const [id, times] of recent) if (now - times[times.length - 1] > WINDOW_MS) recent.delete(id);

	return hits.length > MAX_TOGGLES;
}

// Alterna el me gusta del usuario en un target (ver src/lib/likes.ts). Hace falta
// sesión de Discord; nadie puede gustarse a sí mismo (su propio testimonio).
export const POST: APIRoute = async ({ request, cookies }) => {
	const auth = await requireUser(request, cookies);
	if ("response" in auth) return auth.response;

	if (rateLimited(auth.user.id)) return json({ error: "rate_limited", message: "Vas demasiado rápido." }, 429);

	const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
	const target = typeof body?.target === "string" ? body.target : "";

	const resolved = resolveTarget(target);
	if (!resolved) return json({ error: "invalid_target", message: "No se puede dar me gusta a eso." }, 400);
	if (resolved.ownerId === auth.user.id) {
		return json({ error: "own_target", message: "No puedes dar me gusta a tu propio comentario." }, 403);
	}

	return json(toggleLike(target, auth.user.id));
};
