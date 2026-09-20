// Lado web de la verificación de miembros (contrato en bots/SPAgency/docs/verification.md).
//
// Flujo: el bot manda por DM un enlace `<VERIFICATION_WEB_URL>/<token>`. Aquí se
// comprueba que quien lo abre es esa misma cuenta de Discord (OAuth2), se pasa
// un captcha y, solo entonces, se le pide al bot que conceda el rol. El token
// lo firma el bot con un secreto que la web NO tiene: la web nunca lo descifra,
// se lo pregunta al bot.
import { callBot } from "./bot-api";

export interface VerificationTarget {
	guildId: string;
	userId: string;
}

// El token es `<payload>.<firma>` en base64url; se comprueba la forma antes de
// mandarlo a ninguna parte (viaja en una ruta, no en el cuerpo).
export function isPlausibleToken(token: string): boolean {
	return /^[\w-]{10,400}\.[\w-]{10,200}$/.test(token);
}

// A quién pertenece el token (o 400 invalid_token si está mal, falsificado o caducado).
export function lookupToken(token: string) {
	return callBot<VerificationTarget>("GET", `/verify/${encodeURIComponent(token)}`);
}

// Pide al bot que conceda el rol de verificado. Solo se llama tras identidad + captcha.
export function completeVerification(token: string) {
	return callBot<{ granted: true }>("POST", `/verify/${encodeURIComponent(token)}/complete`, { body: {} });
}

// ── Captcha (Cloudflare Turnstile) ──────────────────────────────────────────

export function captchaSiteKey(): string | null {
	return process.env.TURNSTILE_SITE_KEY || null;
}

// Sin las dos claves configuradas la verificación no se ofrece: es mejor no
// verificar a nadie que dejar pasar sin captcha (falla cerrado).
export function captchaConfigured(): boolean {
	return Boolean(process.env.TURNSTILE_SITE_KEY && process.env.TURNSTILE_SECRET_KEY);
}

// Un token de Turnstile solo vale una vez y solo lo puede validar el servidor,
// con la clave secreta. Cualquier fallo (red incluida) cuenta como "no pasa".
export async function verifyCaptcha(response: string, ip?: string): Promise<boolean> {
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

// ── Errores → mensaje para el usuario ───────────────────────────────────────

const MESSAGES: Record<string, string> = {
	invalid_token: "Este enlace no es válido o ha caducado. Vuelve a Discord y pide uno nuevo.",
	wrong_account: "Este enlace es de otra cuenta de Discord. Cierra sesión e inicia con la cuenta que recibió el mensaje.",
	invalid_captcha: "No pudimos comprobar que eres una persona. Inténtalo de nuevo.",
	not_configured: "La verificación ya no está activa en este servidor. Avisa a un administrador.",
	grant_failed: "No pudimos darte el rol. Avisa a un administrador del servidor.",
	unauthorized: "Inicia sesión con Discord para continuar.",
};

const UNAVAILABLE = "La verificación no está disponible ahora mismo. Inténtalo de nuevo en unos minutos.";

export function verificationErrorMessage(error: string, status: number): string {
	if (MESSAGES[error]) return MESSAGES[error];
	return status >= 500 ? UNAVAILABLE : "No se pudo completar la verificación.";
}
