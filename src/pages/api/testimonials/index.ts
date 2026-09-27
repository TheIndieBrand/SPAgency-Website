import type { APIRoute } from "astro";
import { communityTestimonialsRepository, normalizeComment } from "../../../lib/CommunityTestimonialsRepository";
import { userAvatarUrl } from "../../../lib/discord";
import { json, requireUser } from "../../../lib/session";
import { safeAvatar } from "../../../lib/support-format";

export const prerender = false;

const REJECTIONS: Record<string, { status: number; message: string }> = {
	already_published: { status: 409, message: "Ya tienes un testimonio publicado. Solo se puede tener uno." },
	pending_exists: { status: 409, message: "Ya tienes un comentario pendiente de revisión. Espera a que el staff lo revise." },
	cooldown: { status: 429, message: "Espera un momento antes de enviar otro comentario." },
	daily_limit: { status: 429, message: "Has enviado varios comentarios hoy. Inténtalo de nuevo mañana." },
};

// submits a comment. it stays PENDING: not shown anywhere until staff
// approves it. the name and avatar come from the discord session, never from
// the request body, so nobody can sign as someone else.
export const POST: APIRoute = async ({ request, cookies }) => {
	const auth = await requireUser(request, cookies);
	if ("response" in auth) return auth.response;

	const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
	const checked = normalizeComment(body?.comment);
	if (!checked.ok) return json({ error: "invalid_comment", message: checked.message }, 400);

	const { user } = auth;
	const result = communityTestimonialsRepository.submitComment(
		{
			id: user.id,
			username: user.username,
			displayName: user.global_name || user.username,
			// Solo se guarda un avatar de la CDN de Discord.
			avatar: safeAvatar(userAvatarUrl(user)) ?? "https://cdn.discordapp.com/embed/avatars/0.png",
		},
		checked.comment,
	);

	if (!result.ok) {
		const rejection = REJECTIONS[result.error];
		return json({ error: result.error, message: rejection.message }, rejection.status);
	}

	return json({ ok: true, status: "pending" }, 201);
};
