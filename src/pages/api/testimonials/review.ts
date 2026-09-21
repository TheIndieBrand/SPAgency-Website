import type { APIRoute } from "astro";
import { setStatus, type CommentStatus } from "../../../lib/community-testimonials";
import { requireStaff } from "../../../lib/chat/staff";
import { json } from "../../../lib/session";

export const prerender = false;

const STATUSES: readonly CommentStatus[] = ["approved", "rejected", "pending"];

// Decisión del staff sobre un comentario: aprobar, rechazar, o volver a dejarlo
// pendiente (deshacer). Se comprueba en el servidor en cada petición; quedan
// guardados quién decidió y cuándo.
export const POST: APIRoute = async ({ request, cookies }) => {
	const auth = await requireStaff(request, cookies);
	if ("response" in auth) return auth.response;

	const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
	const id = Number(body?.id);
	const status = body?.status as CommentStatus;

	if (!Number.isInteger(id) || id <= 0 || !STATUSES.includes(status)) {
		return json({ error: "invalid_body", message: "Petición no válida." }, 400);
	}

	return setStatus(id, status, auth.user.id)
		? json({ ok: true })
		: json({ error: "not_found", message: "Ese comentario no existe." }, 404);
};
