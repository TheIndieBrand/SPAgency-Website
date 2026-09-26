// Cliente genérico de la API HTTP del bot (ver docs/README.md). Un solo servidor,
// una sola clave (INTERNAL_API_KEY) para todo lo que la web le pide al bot. El
// bot escucha solo en 127.0.0.1 y la clave nunca sale del servidor de la web: el
// navegador habla con la web, y la web con el bot.

const TimeoutMs = 6000;

export type BotResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

export async function callBot<T>(
	method: "GET" | "POST",
	path: string,
	{ query, body }: { query?: Record<string, string | undefined>; body?: unknown } = {},
): Promise<BotResult<T>> {
	const base = process.env.BOT_API_URL;
	const key = process.env.INTERNAL_API_KEY;
	if (!base || !key) return { ok: false, status: 503, error: "not_configured" };

	const url = new URL(path, base);
	for (const [name, value] of Object.entries(query ?? {})) {
		if (value !== undefined) url.searchParams.set(name, value);
	}

	try {
		const res = await fetch(url, {
			method,
			headers: {
				Authorization: `Bearer ${key}`,
				...(body === undefined ? {} : { "Content-Type": "application/json" }),
			},
			body: body === undefined ? undefined : JSON.stringify(body),
			signal: AbortSignal.timeout(TimeoutMs),
		});

		const data = await res.json().catch(() => null);
		if (!res.ok) {
			return { ok: false, status: res.status, error: typeof data?.error === "string" ? data.error : "unknown" };
		}
		return { ok: true, data: data as T };
	} catch {
		// Bot caído, sin red local o respuesta tardía: para la web es lo mismo.
		return { ok: false, status: 503, error: "bot_unavailable" };
	}
}
