import type { APIRoute } from "astro";
import { createHash, timingSafeEqual } from "node:crypto";
import { json } from "../../../lib/session";
import { parseTranscript, supportTranscriptRepository } from "../../../lib/SupportTranscriptRepository";

export const prerender = false;

const MaxBodyBytes = 5_000_000;

// constant-time comparison: hashes are compared (always the same length) so
// neither timing nor length leaks anything about the key.
function keyMatches(header: string | null, expected: string): boolean {
	const given = header?.startsWith("Bearer ") ? header.slice(7) : "";
	const a = createHash("sha256").update(given).digest();
	const b = createHash("sha256").update(expected).digest();
	return timingSafeEqual(a, b);
}

// route ONLY for the bot (never used by the browser): when a ticket closes,
// the bot pushes the transcript here and doesn't delete the channel until it
// gets a 2xx. idempotent by ticketId, so retries are safe. best restricted at
// the reverse proxy to 127.0.0.1 (see docs/support.md).
export const POST: APIRoute = async ({ request }) => {
	const expected = process.env.INTERNAL_API_KEY;
	if (!expected) return json({ error: "not_configured" }, 503);
	if (!keyMatches(request.headers.get("authorization"), expected)) return json({ error: "unauthorized" }, 401);

	if (Number(request.headers.get("content-length") ?? 0) > MaxBodyBytes) {
		return json({ error: "payload_too_large" }, 413);
	}

	const transcript = parseTranscript(await request.json().catch(() => null));
	if (typeof transcript === "string") return json({ error: "invalid_body", detail: transcript }, 400);

	supportTranscriptRepository.saveTranscript(transcript);
	return json({ ok: true });
};
