import { randomBytes } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { openDatabase } from "../sqlite";

// Almacén del asistente (data/chat.db, o CHAT_DB_PATH). Las conversaciones se
// guardan para siempre: el usuario no tiene forma de borrarlas y solo el staff
// puede hacerlo (ver /staff/chat), dejando constancia en staff_audit. El uso
// diario vive en su propia tabla a propósito: borrar una conversación no
// devuelve tokens.

export type Role = "user" | "assistant" | "note";
export type ProposalStatus = "pending" | "confirming" | "confirmed" | "dismissed";

export interface Conversation {
	id: string;
	userId: string;
	userName: string;
	title: string;
	createdAt: string;
	updatedAt: string;
	ticketId: string | null;
}

export interface StoredMessage {
	id: number;
	conversationId: string;
	role: Role;
	content: string;
	createdAt: string;
	units: number;
	proposalId: string | null;
}

export interface Proposal {
	id: string;
	conversationId: string;
	userId: string;
	subject: string;
	summary: string;
	status: ProposalStatus;
	ticketId: string | null;
	createdAt: string;
}

let db: DatabaseSync | null = null;

function getDb(): DatabaseSync {
	if (db) return db;

	db = openDatabase("CHAT_DB_PATH", "data/chat.db");
	db.exec(`
		PRAGMA journal_mode = WAL;
		PRAGMA foreign_keys = ON;

		CREATE TABLE IF NOT EXISTS conversations (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL,
			user_name TEXT NOT NULL,
			title TEXT NOT NULL,
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL,
			ticket_id TEXT
		);
		CREATE INDEX IF NOT EXISTS conversations_user ON conversations (user_id, updated_at DESC);

		CREATE TABLE IF NOT EXISTS messages (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			conversation_id TEXT NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
			role TEXT NOT NULL,
			content TEXT NOT NULL,
			created_at TEXT NOT NULL,
			units REAL NOT NULL DEFAULT 0,
			proposal_id TEXT
		);
		CREATE INDEX IF NOT EXISTS messages_conversation ON messages (conversation_id, id);

		CREATE TABLE IF NOT EXISTS proposals (
			id TEXT PRIMARY KEY,
			conversation_id TEXT NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
			user_id TEXT NOT NULL,
			subject TEXT NOT NULL,
			summary TEXT NOT NULL,
			status TEXT NOT NULL,
			ticket_id TEXT,
			created_at TEXT NOT NULL
		);

		CREATE TABLE IF NOT EXISTS consents (
			user_id TEXT NOT NULL,
			version TEXT NOT NULL,
			accepted_at TEXT NOT NULL,
			PRIMARY KEY (user_id, version)
		);

		CREATE TABLE IF NOT EXISTS usage_daily (
			user_id TEXT NOT NULL,
			day TEXT NOT NULL,
			units REAL NOT NULL DEFAULT 0,
			requests INTEGER NOT NULL DEFAULT 0,
			prompt_tokens INTEGER NOT NULL DEFAULT 0,
			cached_tokens INTEGER NOT NULL DEFAULT 0,
			completion_tokens INTEGER NOT NULL DEFAULT 0,
			PRIMARY KEY (user_id, day)
		);

		CREATE TABLE IF NOT EXISTS staff_audit (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			staff_id TEXT NOT NULL,
			action TEXT NOT NULL,
			conversation_id TEXT,
			target_user_id TEXT,
			detail TEXT,
			at TEXT NOT NULL
		);
	`);

	// Bases creadas antes de detallar el consumo: se añaden las columnas nuevas.
	const columns = new Set((db.prepare("PRAGMA table_info(usage_daily)").all() as unknown as { name: string }[]).map((c) => c.name));
	for (const column of ["requests", "prompt_tokens", "cached_tokens", "completion_tokens"]) {
		if (!columns.has(column)) db.exec(`ALTER TABLE usage_daily ADD COLUMN ${column} INTEGER NOT NULL DEFAULT 0`);
	}
	return db;
}

const now = () => new Date().toISOString();
const newId = () => randomBytes(12).toString("base64url");

interface ConversationRow {
	id: string;
	user_id: string;
	user_name: string;
	title: string;
	created_at: string;
	updated_at: string;
	ticket_id: string | null;
}

const toConversation = (r: ConversationRow): Conversation => ({
	id: r.id,
	userId: r.user_id,
	userName: r.user_name,
	title: r.title,
	createdAt: r.created_at,
	updatedAt: r.updated_at,
	ticketId: r.ticket_id,
});

// ── Conversaciones ──────────────────────────────────────────────────────────

export function createConversation(userId: string, userName: string, title: string): string {
	const id = newId();
	const at = now();
	getDb()
		.prepare("INSERT INTO conversations (id, user_id, user_name, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
		.run(id, userId, userName, title.slice(0, 80), at, at);
	return id;
}

export function getConversation(id: string): Conversation | null {
	const row = getDb().prepare("SELECT * FROM conversations WHERE id = ?").get(id) as unknown as ConversationRow | undefined;
	return row ? toConversation(row) : null;
}

export function listConversations(userId: string, limit = 30): Conversation[] {
	const rows = getDb()
		.prepare("SELECT * FROM conversations WHERE user_id = ? ORDER BY updated_at DESC LIMIT ?")
		.all(userId, limit) as unknown as ConversationRow[];
	return rows.map(toConversation);
}

export function touchConversation(id: string): void {
	getDb().prepare("UPDATE conversations SET updated_at = ? WHERE id = ?").run(now(), id);
}

export function setConversationTicket(id: string, ticketId: string): void {
	getDb().prepare("UPDATE conversations SET ticket_id = ? WHERE id = ?").run(ticketId, id);
}

// ── Mensajes ────────────────────────────────────────────────────────────────

interface MessageRow {
	id: number;
	conversation_id: string;
	role: string;
	content: string;
	created_at: string;
	units: number;
	proposal_id: string | null;
}

const toMessage = (r: MessageRow): StoredMessage => ({
	id: r.id,
	conversationId: r.conversation_id,
	role: r.role as Role,
	content: r.content,
	createdAt: r.created_at,
	units: r.units,
	proposalId: r.proposal_id,
});

export function addMessage(input: {
	conversationId: string;
	role: Role;
	content: string;
	units?: number;
	proposalId?: string | null;
}): number {
	const result = getDb()
		.prepare("INSERT INTO messages (conversation_id, role, content, created_at, units, proposal_id) VALUES (?, ?, ?, ?, ?, ?)")
		.run(input.conversationId, input.role, input.content, now(), input.units ?? 0, input.proposalId ?? null);
	touchConversation(input.conversationId);
	return Number(result.lastInsertRowid);
}

export function listMessages(conversationId: string): StoredMessage[] {
	const rows = getDb()
		.prepare("SELECT * FROM messages WHERE conversation_id = ? ORDER BY id")
		.all(conversationId) as unknown as MessageRow[];
	return rows.map(toMessage);
}

// Los últimos mensajes que se reenvían al modelo (solo lo que dijeron el usuario
// y el asistente; las notas del sistema no cuentan).
export function recentTurns(conversationId: string, limit: number): { role: "user" | "assistant"; content: string }[] {
	const rows = getDb()
		.prepare("SELECT role, content FROM messages WHERE conversation_id = ? AND role IN ('user', 'assistant') ORDER BY id DESC LIMIT ?")
		.all(conversationId, limit) as unknown as { role: "user" | "assistant"; content: string }[];
	return rows.reverse();
}

// ── Propuestas de ticket ────────────────────────────────────────────────────

interface ProposalRow {
	id: string;
	conversation_id: string;
	user_id: string;
	subject: string;
	summary: string;
	status: string;
	ticket_id: string | null;
	created_at: string;
}

const toProposal = (r: ProposalRow): Proposal => ({
	id: r.id,
	conversationId: r.conversation_id,
	userId: r.user_id,
	subject: r.subject,
	summary: r.summary,
	status: r.status as ProposalStatus,
	ticketId: r.ticket_id,
	createdAt: r.created_at,
});

export function createProposal(input: { conversationId: string; userId: string; subject: string; summary: string }): string {
	const id = newId();
	getDb()
		.prepare("INSERT INTO proposals (id, conversation_id, user_id, subject, summary, status, created_at) VALUES (?, ?, ?, ?, ?, 'pending', ?)")
		.run(id, input.conversationId, input.userId, input.subject, input.summary, now());
	return id;
}

export function getProposal(id: string): Proposal | null {
	const row = getDb().prepare("SELECT * FROM proposals WHERE id = ?").get(id) as unknown as ProposalRow | undefined;
	return row ? toProposal(row) : null;
}

export function listProposals(conversationId: string): Proposal[] {
	const rows = getDb().prepare("SELECT * FROM proposals WHERE conversation_id = ?").all(conversationId) as unknown as ProposalRow[];
	return rows.map(toProposal);
}

// Cambio de estado atómico: solo pasa si sigue en `from`. Es lo que impide que
// dos clics (o dos pestañas) abran dos tickets con la misma propuesta.
export function moveProposal(id: string, from: ProposalStatus, to: ProposalStatus, ticketId?: string): boolean {
	const result = getDb()
		.prepare("UPDATE proposals SET status = ?, ticket_id = COALESCE(?, ticket_id) WHERE id = ? AND status = ?")
		.run(to, ticketId ?? null, id, from);
	return Number(result.changes) === 1;
}

// ── Consentimiento y uso ────────────────────────────────────────────────────

export function hasConsent(userId: string, version: string): boolean {
	return Boolean(getDb().prepare("SELECT 1 FROM consents WHERE user_id = ? AND version = ?").get(userId, version));
}

export function saveConsent(userId: string, version: string): void {
	getDb().prepare("INSERT OR IGNORE INTO consents (user_id, version, accepted_at) VALUES (?, ?, ?)").run(userId, version, now());
}

export function getUsage(userId: string, day: string): number {
	const row = getDb().prepare("SELECT units FROM usage_daily WHERE user_id = ? AND day = ?").get(userId, day) as unknown as
		| { units: number }
		| undefined;
	return row?.units ?? 0;
}

export interface DayUsage {
	day: string;
	units: number;
	requests: number;
	promptTokens: number;
	cachedTokens: number;
	completionTokens: number;
}

export function addUsage(
	userId: string,
	day: string,
	add: { units: number; promptTokens: number; cachedTokens: number; completionTokens: number },
): void {
	getDb()
		.prepare(
			`INSERT INTO usage_daily (user_id, day, units, requests, prompt_tokens, cached_tokens, completion_tokens)
			 VALUES (?, ?, ?, 1, ?, ?, ?)
			 ON CONFLICT(user_id, day) DO UPDATE SET
				units = units + excluded.units,
				requests = requests + 1,
				prompt_tokens = prompt_tokens + excluded.prompt_tokens,
				cached_tokens = cached_tokens + excluded.cached_tokens,
				completion_tokens = completion_tokens + excluded.completion_tokens`,
		)
		.run(userId, day, add.units, add.promptTokens, add.cachedTokens, add.completionTokens);
}

// Consumo de los días pedidos (los que no tienen fila no aparecen).
export function getUsageDays(userId: string, days: string[]): DayUsage[] {
	if (!days.length) return [];
	const rows = getDb()
		.prepare(
			`SELECT day, units, requests, prompt_tokens, cached_tokens, completion_tokens FROM usage_daily
			 WHERE user_id = ? AND day IN (${days.map(() => "?").join(",")}) ORDER BY day`,
		)
		.all(userId, ...days) as unknown as {
		day: string;
		units: number;
		requests: number;
		prompt_tokens: number;
		cached_tokens: number;
		completion_tokens: number;
	}[];
	return rows.map((r) => ({
		day: r.day,
		units: r.units,
		requests: r.requests,
		promptTokens: r.prompt_tokens,
		cachedTokens: r.cached_tokens,
		completionTokens: r.completion_tokens,
	}));
}

// ── Staff ───────────────────────────────────────────────────────────────────

export interface ConversationSummary extends Conversation {
	messageCount: number;
}

// Busca por ID de conversación, ID de usuario, nombre o título.
export function searchConversations(query: string, limit = 100): ConversationSummary[] {
	const q = query.trim();
	const like = `%${q.replace(/[%_\\]/g, "\\$&")}%`;
	const rows = getDb()
		.prepare(
			`SELECT c.*, (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) AS message_count
			 FROM conversations c
			 WHERE ? = '' OR c.id = ? OR c.user_id = ? OR c.user_name LIKE ? ESCAPE '\\' OR c.title LIKE ? ESCAPE '\\'
			 ORDER BY c.updated_at DESC LIMIT ?`,
		)
		.all(q, q, q, like, like, limit) as unknown as (ConversationRow & { message_count: number })[];
	return rows.map((r) => ({ ...toConversation(r), messageCount: r.message_count }));
}

// Borra la conversación con sus mensajes y propuestas (ON DELETE CASCADE).
export function deleteConversation(id: string): boolean {
	const result = getDb().prepare("DELETE FROM conversations WHERE id = ?").run(id);
	return Number(result.changes) === 1;
}

export function logStaffAction(input: {
	staffId: string;
	action: "search" | "read" | "delete";
	conversationId?: string | null;
	targetUserId?: string | null;
	detail?: string | null;
}): void {
	getDb()
		.prepare("INSERT INTO staff_audit (staff_id, action, conversation_id, target_user_id, detail, at) VALUES (?, ?, ?, ?, ?, ?)")
		.run(input.staffId, input.action, input.conversationId ?? null, input.targetUserId ?? null, input.detail ?? null, now());
}
