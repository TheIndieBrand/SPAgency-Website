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

let db: DatabaseSync | null = null;

// Los transcripts se guardan para siempre (sin retención ni borrado automático).
// Los entrega el bot al cerrar un ticket; la web es quien los conserva.
function getDb(): DatabaseSync {
	if (db) return db;

	db = openDatabase("SUPPORT_DB_PATH", "data/support.db");
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
	return db;
}

// Idempotente por ticketId: si el bot reintenta el envío, no se duplica nada.
export function saveTranscript(t: Transcript): void {
	getDb()
		.prepare(
			`INSERT INTO support_transcripts (ticket_id, user_id, subject, opened_at, closed_at, closed_by, messages, received_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			 ON CONFLICT(ticket_id) DO UPDATE SET
				user_id = excluded.user_id, subject = excluded.subject, opened_at = excluded.opened_at,
				closed_at = excluded.closed_at, closed_by = excluded.closed_by, messages = excluded.messages`,
		)
		.run(t.ticketId, t.userId, t.subject, t.openedAt, t.closedAt, t.closedBy, JSON.stringify(t.messages), new Date().toISOString());
}

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

// Un transcript solo lo ve su dueño: si el ticket es de otro usuario, es como
// si no existiera.
export function getTranscript(ticketId: string, userId: string): Transcript | null {
	const row = getDb()
		.prepare("SELECT * FROM support_transcripts WHERE ticket_id = ? AND user_id = ?")
		.get(ticketId, userId) as unknown as Row | undefined;
	return row ? toTranscript(row) : null;
}

export function listTranscripts(userId: string): TranscriptSummary[] {
	const rows = getDb()
		.prepare("SELECT * FROM support_transcripts WHERE user_id = ? ORDER BY closed_at DESC")
		.all(userId) as unknown as Row[];

	return rows.map((row) => {
		const { messages, ...summary } = toTranscript(row);
		return { ...summary, messageCount: messages.length };
	});
}

const MAX_MESSAGES = 5000;
const isString = (v: unknown, max: number): v is string => typeof v === "string" && v.length <= max;
const isIso = (v: unknown): v is string => typeof v === "string" && v.length <= 40 && !Number.isNaN(Date.parse(v));

// Valida lo que empuja el bot. Devuelve el transcript ya normalizado o un
// mensaje de error. Nada se guarda sin pasar por aquí.
export function parseTranscript(body: unknown): Transcript | string {
	if (!body || typeof body !== "object") return "Cuerpo inválido";
	const b = body as Record<string, unknown>;

	if (!isString(b.ticketId, 64) || !/^[\w-]{8,64}$/.test(b.ticketId)) return "ticketId inválido";
	if (!isString(b.userId, 32) || !/^\d{15,25}$/.test(b.userId)) return "userId inválido";
	if (!isString(b.subject, 200) || !b.subject.trim()) return "subject inválido";
	if (!isIso(b.openedAt) || !isIso(b.closedAt)) return "Fechas inválidas";
	if (b.closedBy !== "user" && b.closedBy !== "staff") return "closedBy inválido";
	if (!Array.isArray(b.messages) || b.messages.length > MAX_MESSAGES) return "messages inválido";

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
