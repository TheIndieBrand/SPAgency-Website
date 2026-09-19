import type { APIRoute } from "astro";
import { createHash, timingSafeEqual } from "node:crypto";
import { json } from "../../../lib/session";
import { parseTranscript, saveTranscript } from "../../../lib/support-transcripts";

export const prerender = false;

const MAX_BODY_BYTES = 5_000_000;

// Comparación en tiempo constante: se comparan los hashes (misma longitud
// siempre) para que ni el tiempo ni la longitud delaten nada de la clave.
function keyMatches(header: string | null, expected: string): boolean {
	const given = header?.startsWith("Bearer ") ? header.slice(7) : "";
	const a = createHash("sha256").update(given).digest();
	const b = createHash("sha256").update(expected).digest();
	return timingSafeEqual(a, b);
}

// Ruta SOLO para el bot (no la usa el navegador): al cerrar un ticket, el bot
// empuja aquí el transcript y no borra el canal hasta recibir un 2xx. Es
// idempotente por ticketId, así que los reintentos son seguros. Conviene
// restringirla en el proxy inverso a 127.0.0.1 (ver docs/support.md).
export const POST: APIRoute = async ({ request }) => {
	const expected = process.env.SUPPORT_WEB_API_KEY;
	if (!expected) return json({ error: "not_configured" }, 503);
	if (!keyMatches(request.headers.get("authorization"), expected)) return json({ error: "unauthorized" }, 401);

	if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
		return json({ error: "payload_too_large" }, 413);
	}

	const transcript = parseTranscript(await request.json().catch(() => null));
	if (typeof transcript === "string") return json({ error: "invalid_body", detail: transcript }, 400);

	saveTranscript(transcript);
	return json({ ok: true });
};
