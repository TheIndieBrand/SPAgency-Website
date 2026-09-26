import { callBot } from "./bot-api";

// web side of member verification (contract in bots/SPAgency/docs/verification.md).
//
// flow: the bot dms a `<VERIFICATION_WEB_URL>/<token>` link. here it's checked
// that whoever opens it is that same discord account (oauth2), a captcha is
// solved, and only then is the bot asked to grant the role. the token is
// signed by the bot with a secret the web does NOT have: the web never
// decodes it, it asks the bot.

export interface VerificationTarget {
	guildId: string;
	userId: string;
}

const ErrorMessages: Record<string, string> = {
	invalid_token: "Este enlace no es válido o ha caducado. Vuelve a Discord y pide uno nuevo.",
	wrong_account: "Este enlace es de otra cuenta de Discord. Cierra sesión e inicia con la cuenta que recibió el mensaje.",
	invalid_captcha: "No pudimos comprobar que eres una persona. Inténtalo de nuevo.",
	not_configured: "La verificación ya no está activa en este servidor. Avisa a un administrador.",
	grant_failed: "No pudimos darte el rol. Avisa a un administrador del servidor.",
	unauthorized: "Inicia sesión con Discord para continuar.",
};

const UnavailableMessage = "La verificación no está disponible ahora mismo. Inténtalo de nuevo en unos minutos.";

/**
 * the web's side of the discord member verification flow: token checks, the
 * bot handshake, and the turnstile captcha.
 */
export class VerificationService {
	/**
	 * the token is `<payload>.<signature>` in base64url; its shape is checked
	 * before it's sent anywhere (it travels in a path, not the body).
	 */
	isPlausibleToken(token: string): boolean {
		return /^[\w-]{10,400}\.[\w-]{10,200}$/.test(token);
	}

	/** who a token belongs to (or a 400 invalid_token if it's malformed, forged or expired). */
	lookupToken(token: string) {
		return callBot<VerificationTarget>("GET", `/verify/${encodeURIComponent(token)}`);
	}

	/** asks the bot to grant the verified role. only called after identity + captcha. */
	completeVerification(token: string) {
		return callBot<{ granted: true }>("POST", `/verify/${encodeURIComponent(token)}/complete`, { body: {} });
	}

	// ── captcha (cloudflare turnstile) ──────────────────────────────────────

	captchaSiteKey(): string | null {
		return process.env.TURNSTILE_SITE_KEY || null;
	}

	/** without both keys configured, verification isn't offered: better to verify nobody than to let anyone through without a captcha (fails closed). */
	captchaConfigured(): boolean {
		return Boolean(process.env.TURNSTILE_SITE_KEY && process.env.TURNSTILE_SECRET_KEY);
	}

	/**
	 * a turnstile token is only valid once and only the server can validate
	 * it, with the secret key. any failure (network included) counts as "doesn't pass".
	 */
	async verifyCaptcha(response: string, ip?: string): Promise<boolean> {
		const secret = process.env.TURNSTILE_SECRET_KEY;
		if (!secret || !response || response.length > 2048) return false;

		const form = new URLSearchParams({ secret, response });
		if (ip) form.set("remoteip", ip);

		try {
			const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
				method: "POST",
				body: form,
				signal: AbortSignal.timeout(6000),
			});
			const data = (await res.json()) as { success?: boolean };
			return data.success === true;
		} catch {
			return false;
		}
	}

	// ── errors → user-facing message ────────────────────────────────────────

	verificationErrorMessage(error: string, status: number): string {
		if (ErrorMessages[error]) return ErrorMessages[error];
		return status >= 500 ? UnavailableMessage : "No se pudo completar la verificación.";
	}
}

export const verificationService = new VerificationService();
