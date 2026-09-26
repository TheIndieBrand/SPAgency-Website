// client for the bot's support api (see docs/support.md). the bot only
// listens on 127.0.0.1 and authenticates with INTERNAL_API_KEY, which never
// leaves here: the browser talks to the web, and the web talks to the bot.

import { callBot as call } from "./bot-api";
import { json } from "./session";
import { supportErrorMessage } from "./support-format";

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

// translates a bot failure into the response the browser sees. the bot
// rejecting our key (401/403) is a configuration problem, not the user's:
// to them, support is simply unavailable.
export function botFailure(result: { status: number; error: string }): Response {
	const misconfigured = result.status === 401 || result.status === 403;
	const status = misconfigured ? 503 : result.status;
	const error = misconfigured ? "bot_unavailable" : result.error;
	return json({ error, message: supportErrorMessage(error, status) }, status);
}
