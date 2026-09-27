import type { APIRoute } from "astro";
import { json, requireUser } from "../../../lib/session";
import { verificationService } from "../../../lib/VerificationService";

export const prerender = false;

const fail = (status: number, error: string) => json({ error, message: verificationService.verificationErrorMessage(error, status) }, status);

// the bot rejecting our key (401/403) is a configuration problem, not the
// user's: to them, verification is simply unavailable.
const fromBot = (status: number, error: string) =>
	status === 401 || status === 403 ? fail(503, "bot_unavailable") : fail(status, error);

// completes a verification. required, in this order: a discord session, that
// the token belongs to THAT account (which is what proves the link is opened
// by whoever received it), and a passed captcha. only then does the bot grant the role.
export const POST: APIRoute = async ({ request, cookies, clientAddress }) => {
	const auth = await requireUser(request, cookies);
	if ("response" in auth) return auth.response;

	if (!verificationService.captchaConfigured()) return fail(503, "not_configured");

	const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
	const token = typeof body?.token === "string" ? body.token : "";
	const captcha = typeof body?.captcha === "string" ? body.captcha : "";
	if (!verificationService.isPlausibleToken(token)) return fail(400, "invalid_token");

	// identity is read from the bot on every attempt: the browser can't say whose token it is.
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
