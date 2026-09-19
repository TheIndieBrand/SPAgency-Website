// Cliente de la API de soporte del bot (ver docs/support.md). El bot escucha
// solo en 127.0.0.1 y se autentica con SUPPORT_API_KEY, que nunca sale de aquí:
// el navegador habla con la web, y la web con el bot.

import { json } from "./session";
import { supportErrorMessage } from "./support-format";

const TIMEOUT_MS = 6000;

export interface BotMessage {
	id: string;
	author: "staff" | "user";
	name: string;
	avatar: string | null;
	content: string;
	at: string;
}

export interface BotTicket {
	ticketId: string;
	subject: string;
	createdAt: string;
}

export type BotResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

async function call<T>(
	method: "GET" | "POST",
	path: string,
	{ query, body }: { query?: Record<string, string | undefined>; body?: unknown } = {},
): Promise<BotResult<T>> {
	const base = process.env.SUPPORT_BOT_URL;
	const key = process.env.SUPPORT_API_KEY;
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
			signal: AbortSignal.timeout(TIMEOUT_MS),
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

const ticketPath = (ticketId: string) => `/support/tickets/${encodeURIComponent(ticketId)}`;

export function createTicket(input: {
	userId: string;
	username: string;
	avatarUrl: string;
	subject: string;
	message: string;
}) {
	return call<{ ticketId: string; createdAt: string }>("POST", "/support/tickets", { body: input });
}

export function listOpenTickets(userId: string) {
	return call<{ tickets: BotTicket[] }>("GET", "/support/tickets", { query: { userId } });
}

export function getTicketMessages(ticketId: string, userId: string, after?: string) {
	return call<{ messages: BotMessage[] }>("GET", `${ticketPath(ticketId)}/messages`, { query: { userId, after } });
}

export function sendTicketMessage(ticketId: string, userId: string, content: string) {
	return call<{ id: string }>("POST", `${ticketPath(ticketId)}/messages`, { body: { userId, content } });
}

export function closeTicket(ticketId: string, userId: string) {
	return call<{ closing: true }>("POST", `${ticketPath(ticketId)}/close`, { body: { userId } });
}

// Traduce un fallo del bot a la respuesta que ve el navegador. Que el bot
// rechace nuestra clave (401/403) es un problema de configuración, no del
// usuario: para él, soporte simplemente no está disponible.
export function botFailure(result: { status: number; error: string }): Response {
	const misconfigured = result.status === 401 || result.status === 403;
	const status = misconfigured ? 503 : result.status;
	const error = misconfigured ? "bot_unavailable" : result.error;
	return json({ error, message: supportErrorMessage(error, status) }, status);
}
