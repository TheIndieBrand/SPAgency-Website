import type { APIRoute } from "astro";
import { json, requireUser } from "../../../lib/session";
import { verificationService } from "../../../lib/VerificationService";

export const prerender = false;

const fail = (status: number, error: string) => json({ error, message: verificationService.verificationErrorMessage(error, status) }, status);

// Que el bot rechace nuestra clave (401/403) es un problema de configuración,
// no del usuario: para él, la verificación simplemente no está disponible.
const fromBot = (status: number, error: string) =>
	status === 401 || status === 403 ? fail(503, "bot_unavailable") : fail(status, error);

// Cierra una verificación. Se exige, en este orden: sesión de Discord, que el
// token sea de ESA cuenta (es lo que demuestra que el enlace lo abre quien lo
// recibió) y captcha superado. Solo entonces el bot concede el rol.
export const POST: APIRoute = async ({ request, cookies, clientAddress }) => {
	const auth = await requireUser(request, cookies);
	if ("response" in auth) return auth.response;

	if (!verificationService.captchaConfigured()) return fail(503, "not_configured");

	const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
	const token = typeof body?.token === "string" ? body.token : "";
	const captcha = typeof body?.captcha === "string" ? body.captcha : "";
	if (!verificationService.isPlausibleToken(token)) return fail(400, "invalid_token");

	// La identidad se lee del bot en cada intento: el navegador no puede decir de quién es el token.
	const target = await verificationService.lookupToken(token);
	if (!target.ok) return fromBot(target.status, target.error);
	if (target.data.userId !== auth.user.id) return fail(403, "wrong_account");

	let ip: string | undefined;
	try {
		ip = clientAddress;
	} catch {
		ip = undefined;
	}
	if (!(await verificationService.verifyCaptcha(captcha, ip))) return fail(400, "invalid_captcha");

	const done = await verificationService.completeVerification(token);
	if (!done.ok) return fromBot(done.status, done.error);

	return json({ ok: true, guildId: target.data.guildId });
};
