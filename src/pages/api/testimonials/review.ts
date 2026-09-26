import type { APIRoute } from "astro";
import { communityTestimonialsRepository, type CommentStatus } from "../../../lib/CommunityTestimonialsRepository";
import { requireStaff } from "../../../lib/chat/staff";
import { json } from "../../../lib/session";

export const prerender = false;

const STATUSES: readonly CommentStatus[] = ["approved", "rejected", "pending"];

// staff's decision on a comment: approve, reject, or put it back to pending
// (undo). checked on the server on every request; who decided and when are recorded.
export const POST: APIRoute = async ({ request, cookies }) => {
	const auth = await requireStaff(request, cookies);
	if ("response" in auth) return auth.response;

	const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
	const id = Number(body?.id);
	const status = body?.status as CommentStatus;

	if (!Number.isInteger(id) || id <= 0 || !STATUSES.includes(status)) {
		return json({ error: "invalid_body", message: "Petición no válida." }, 400);
	}

	return communityTestimonialsRepository.setStatus(id, status, auth.user.id)
		? json({ ok: true })
		: json({ error: "not_found", message: "Ese comentario no existe." }, 404);
};
