import type { DatabaseSync } from "node:sqlite";
import { openDatabase } from "./sqlite";
import { safeAvatar } from "./support-format";

export interface TranscriptMessage {
	id: string;
	author: "staff" | "user";
	name: string;
	avatar: string | null;
	content: string;
	at: string;
}

export interface Transcript {
	ticketId: string;
	userId: string;
	subject: string;
	openedAt: string;
	closedAt: string;
	closedBy: "user" | "staff";
	messages: TranscriptMessage[];
}

export type TranscriptSummary = Omit<Transcript, "messages"> & { messageCount: number };

interface Row {
	ticket_id: string;
	user_id: string;
	subject: string;
	opened_at: string;
	closed_at: string;
	closed_by: string;
	messages: string;
}

const MaxTranscriptMessages = 5000;
const isString = (v: unknown, max: number): v is string => typeof v === "string" && v.length <= max;
const isIso = (v: unknown): v is string => typeof v === "string" && v.length <= 40 && !Number.isNaN(Date.parse(v));

function toTranscript(row: Row): Transcript {
	return {
		ticketId: row.ticket_id,
		userId: row.user_id,
		subject: row.subject,
		openedAt: row.opened_at,
		closedAt: row.closed_at,
		closedBy: row.closed_by === "staff" ? "staff" : "user",
		messages: JSON.parse(row.messages) as TranscriptMessage[],
	};
}

/**
 * validates what the bot pushes when a ticket closes. returns the normalized
 * transcript, or an error message. nothing is stored without going through this first.
 */
export function parseTranscript(body: unknown): Transcript | string {
	if (!body || typeof body !== "object") return "Cuerpo inválido";
	const b = body as Record<string, unknown>;

	if (!isString(b.ticketId, 64) || !/^[\w-]{8,64}$/.test(b.ticketId)) return "ticketId inválido";
	if (!isString(b.userId, 32) || !/^\d{15,25}$/.test(b.userId)) return "userId inválido";
	if (!isString(b.subject, 200) || !b.subject.trim()) return "subject inválido";
	if (!isIso(b.openedAt) || !isIso(b.closedAt)) return "Fechas inválidas";
	if (b.closedBy !== "user" && b.closedBy !== "staff") return "closedBy inválido";
	if (!Array.isArray(b.messages) || b.messages.length > MaxTranscriptMessages) return "messages inválido";

	const messages: TranscriptMessage[] = [];
	for (const m of b.messages as unknown[]) {
		if (!m || typeof m !== "object") return "Mensaje inválido";
		const x = m as Record<string, unknown>;
		if (!isString(x.id, 32) || !isString(x.name, 100) || !isString(x.content, 4000) || !isIso(x.at)) {
			return "Mensaje inválido";
		}
		if (x.author !== "staff" && x.author !== "user") return "Mensaje inválido";
		messages.push({ id: x.id, author: x.author, name: x.name, avatar: safeAvatar(x.avatar), content: x.content, at: x.at });
	}

	return {
		ticketId: b.ticketId,
		userId: b.userId,
		subject: b.subject.trim(),
		openedAt: b.openedAt,
		closedAt: b.closedAt,
		closedBy: b.closedBy,
		messages,
	};
}

/**
 * closed support tickets' full transcripts, kept forever (no retention or
 * automatic deletion). the bot delivers them when a ticket closes; the web
 * is what keeps them.
 */
export class SupportTranscriptRepository {
	private database: DatabaseSync | null = null;

	private getDb(): DatabaseSync {
		if (this.database) return this.database;

		const db = openDatabase("SUPPORT_DB_PATH", "data/support.db");
		db.exec(`
			CREATE TABLE IF NOT EXISTS support_transcripts (
				ticket_id TEXT PRIMARY KEY,
				user_id TEXT NOT NULL,
				subject TEXT NOT NULL,
				opened_at TEXT NOT NULL,
				closed_at TEXT NOT NULL,
				closed_by TEXT NOT NULL,
				messages TEXT NOT NULL,
				received_at TEXT NOT NULL
			);
			CREATE INDEX IF NOT EXISTS support_transcripts_user ON support_transcripts (user_id, closed_at DESC);
		`);
		this.database = db;
		return db;
	}

	/** idempotent by ticketId: if the bot retries the delivery, nothing is duplicated. */
	saveTranscript(t: Transcript): void {
		this.getDb()
			.prepare(
				`INSERT INTO support_transcripts (ticket_id, user_id, subject, opened_at, closed_at, closed_by, messages, received_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?)
				 ON CONFLICT(ticket_id) DO UPDATE SET
					user_id = excluded.user_id, subject = excluded.subject, opened_at = excluded.opened_at,
					closed_at = excluded.closed_at, closed_by = excluded.closed_by, messages = excluded.messages`,
			)
			.run(t.ticketId, t.userId, t.subject, t.openedAt, t.closedAt, t.closedBy, JSON.stringify(t.messages), new Date().toISOString());
	}

	/** a transcript is only visible to its owner: a ticket that belongs to someone else is treated as if it doesn't exist. */
	getTranscript(ticketId: string, userId: string): Transcript | null {
		const row = this.getDb().prepare("SELECT * FROM support_transcripts WHERE ticket_id = ? AND user_id = ?").get(ticketId, userId) as unknown as Row | undefined;
		return row ? toTranscript(row) : null;
	}

	listTranscripts(userId: string): TranscriptSummary[] {
		const rows = this.getDb().prepare("SELECT * FROM support_transcripts WHERE user_id = ? ORDER BY closed_at DESC").all(userId) as unknown as Row[];

		return rows.map((row) => {
			const { messages, ...summary } = toTranscript(row);
			return { ...summary, messageCount: messages.length };
		});
	}
}

export const supportTranscriptRepository = new SupportTranscriptRepository();
