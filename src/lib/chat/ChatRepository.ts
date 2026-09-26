import { randomBytes } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { openDatabase } from "../sqlite";

// the assistant's store (data/chat.db, or CHAT_DB_PATH). conversations are
// kept forever: the user has no way to delete them, only staff can (see
// /staff/chat), and doing so is logged in staff_audit. daily usage lives in
// its own table on purpose: deleting a conversation doesn't refund tokens.

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

// "ticket": open a ticket with staff. "settings": change guild settings
// (`payload` stores the guild and the already-validated changes, as json).
export type ProposalKind = "ticket" | "settings";

export interface Proposal {
	id: string;
	kind: ProposalKind;
	payload: string | null;
	conversationId: string;
	userId: string;
	subject: string;
	summary: string;
	status: ProposalStatus;
	ticketId: string | null;
	createdAt: string;
}

/** the proposal transition applied by {@link ChatRepository.moveProposal}. */
export interface ProposalTransition {
	from: ProposalStatus;
	to: ProposalStatus;
	ticketId?: string;
}

export interface DayUsage {
	day: string;
	units: number;
	requests: number;
	promptTokens: number;
	cachedTokens: number;
	completionTokens: number;
}

export interface ConversationSummary extends Conversation {
	messageCount: number;
}

interface ConversationRow {
	id: string;
	user_id: string;
	user_name: string;
	title: string;
	created_at: string;
	updated_at: string;
	ticket_id: string | null;
}

interface MessageRow {
	id: number;
	conversation_id: string;
	role: string;
	content: string;
	created_at: string;
	units: number;
	proposal_id: string | null;
}

interface ProposalRow {
	id: string;
	kind: string;
	payload: string | null;
	conversation_id: string;
	user_id: string;
	subject: string;
	summary: string;
	status: string;
	ticket_id: string | null;
	created_at: string;
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

const toMessage = (r: MessageRow): StoredMessage => ({
	id: r.id,
	conversationId: r.conversation_id,
	role: r.role as Role,
	content: r.content,
	createdAt: r.created_at,
	units: r.units,
	proposalId: r.proposal_id,
});

const toProposal = (r: ProposalRow): Proposal => ({
	id: r.id,
	kind: r.kind === "settings" ? "settings" : "ticket",
	payload: r.payload,
	conversationId: r.conversation_id,
	userId: r.user_id,
	subject: r.subject,
	summary: r.summary,
	status: r.status as ProposalStatus,
	ticketId: r.ticket_id,
	createdAt: r.created_at,
});

const now = () => new Date().toISOString();
const newId = () => randomBytes(12).toString("base64url");

/**
 * the assistant's own storage: conversations, messages, ticket/settings
 * proposals, per-user daily usage, and the staff audit log. backed by a
 * local sqlite database, separate from the bot's shared postgres database.
 */
export class ChatRepository {
	private database: DatabaseSync | null = null;

	private getDb(): DatabaseSync {
		if (this.database) return this.database;

		const db = openDatabase("CHAT_DB_PATH", "data/chat.db");
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

			-- the dashboard guild the assistant acts on IN THIS conversation. not carried
			-- over to others: with several guilds, each conversation asks which one.
			DROP TABLE IF EXISTS chat_guild;
			CREATE TABLE IF NOT EXISTS conversation_guild (
				conversation_id TEXT PRIMARY KEY REFERENCES conversations (id) ON DELETE CASCADE,
				guild_id TEXT NOT NULL,
				guild_name TEXT NOT NULL
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

		// databases created before usage detail was tracked: add the new columns.
		const columns = new Set((db.prepare("PRAGMA table_info(usage_daily)").all() as unknown as { name: string }[]).map((c) => c.name));
		for (const column of ["requests", "prompt_tokens", "cached_tokens", "completion_tokens"]) {
			if (!columns.has(column)) db.exec(`ALTER TABLE usage_daily ADD COLUMN ${column} INTEGER NOT NULL DEFAULT 0`);
		}
		const proposalColumns = new Set((db.prepare("PRAGMA table_info(proposals)").all() as unknown as { name: string }[]).map((c) => c.name));
		if (!proposalColumns.has("kind")) db.exec("ALTER TABLE proposals ADD COLUMN kind TEXT NOT NULL DEFAULT 'ticket'");
		if (!proposalColumns.has("payload")) db.exec("ALTER TABLE proposals ADD COLUMN payload TEXT");

		this.database = db;
		return db;
	}

	// ── conversations ──────────────────────────────────────────────────────

	createConversation(userId: string, userName: string, title: string): string {
		const id = newId();
		const at = now();
		this.getDb()
			.prepare("INSERT INTO conversations (id, user_id, user_name, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
			.run(id, userId, userName, title.slice(0, 80), at, at);
		return id;
	}

	getConversation(id: string): Conversation | null {
		const row = this.getDb().prepare("SELECT * FROM conversations WHERE id = ?").get(id) as unknown as ConversationRow | undefined;
		return row ? toConversation(row) : null;
	}

	listConversations(userId: string, limit = 30): Conversation[] {
		const rows = this.getDb()
			.prepare("SELECT * FROM conversations WHERE user_id = ? ORDER BY updated_at DESC LIMIT ?")
			.all(userId, limit) as unknown as ConversationRow[];
		return rows.map(toConversation);
	}

	touchConversation(id: string): void {
		this.getDb().prepare("UPDATE conversations SET updated_at = ? WHERE id = ?").run(now(), id);
	}

	setConversationTicket(id: string, ticketId: string): void {
		this.getDb().prepare("UPDATE conversations SET ticket_id = ? WHERE id = ?").run(ticketId, id);
	}

	// ── messages ───────────────────────────────────────────────────────────

	addMessage(input: { conversationId: string; role: Role; content: string; units?: number; proposalId?: string | null }): number {
		const result = this.getDb()
			.prepare("INSERT INTO messages (conversation_id, role, content, created_at, units, proposal_id) VALUES (?, ?, ?, ?, ?, ?)")
			.run(input.conversationId, input.role, input.content, now(), input.units ?? 0, input.proposalId ?? null);
		this.touchConversation(input.conversationId);
		return Number(result.lastInsertRowid);
	}

	listMessages(conversationId: string): StoredMessage[] {
		const rows = this.getDb()
			.prepare("SELECT * FROM messages WHERE conversation_id = ? ORDER BY id")
			.all(conversationId) as unknown as MessageRow[];
		return rows.map(toMessage);
	}

	/**
	 * the latest messages replayed to the model (only what the user and the
	 * assistant said; system notes don't count).
	 */
	recentTurns(conversationId: string, limit: number): { role: "user" | "assistant"; content: string }[] {
		const rows = this.getDb()
			.prepare("SELECT role, content FROM messages WHERE conversation_id = ? AND role IN ('user', 'assistant') ORDER BY id DESC LIMIT ?")
			.all(conversationId, limit) as unknown as { role: "user" | "assistant"; content: string }[];
		return rows.reverse();
	}

	// ── ticket proposals ───────────────────────────────────────────────────

	createProposal(input: {
		conversationId: string;
		userId: string;
		subject: string;
		summary: string;
		kind?: ProposalKind;
		payload?: unknown;
	}): string {
		const id = newId();
		this.getDb()
			.prepare(
				"INSERT INTO proposals (id, conversation_id, user_id, subject, summary, status, created_at, kind, payload) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?)",
			)
			.run(id, input.conversationId, input.userId, input.subject, input.summary, now(), input.kind ?? "ticket", input.payload === undefined ? null : JSON.stringify(input.payload));
		return id;
	}

	getProposal(id: string): Proposal | null {
		const row = this.getDb().prepare("SELECT * FROM proposals WHERE id = ?").get(id) as unknown as ProposalRow | undefined;
		return row ? toProposal(row) : null;
	}

	listProposals(conversationId: string): Proposal[] {
		const rows = this.getDb().prepare("SELECT * FROM proposals WHERE conversation_id = ?").all(conversationId) as unknown as ProposalRow[];
		return rows.map(toProposal);
	}

	/**
	 * atomic state change: only takes effect if the proposal is still in
	 * `from`. this is what stops two clicks (or two tabs) from opening two
	 * tickets for the same proposal.
	 */
	moveProposal(id: string, transition: ProposalTransition): boolean {
		const result = this.getDb()
			.prepare("UPDATE proposals SET status = ?, ticket_id = COALESCE(?, ticket_id) WHERE id = ? AND status = ?")
			.run(transition.to, transition.ticketId ?? null, id, transition.from);
		return Number(result.changes) === 1;
	}

	// ── chosen guild ───────────────────────────────────────────────────────

	getConversationGuild(conversationId: string): { id: string; name: string } | null {
		const row = this.getDb().prepare("SELECT guild_id, guild_name FROM conversation_guild WHERE conversation_id = ?").get(conversationId) as unknown as
			| { guild_id: string; guild_name: string }
			| undefined;
		return row ? { id: row.guild_id, name: row.guild_name } : null;
	}

	setConversationGuild(conversationId: string, guild: { id: string; name: string }): void {
		this.getDb()
			.prepare(
				"INSERT INTO conversation_guild (conversation_id, guild_id, guild_name) VALUES (?, ?, ?) ON CONFLICT(conversation_id) DO UPDATE SET guild_id = excluded.guild_id, guild_name = excluded.guild_name",
			)
			.run(conversationId, guild.id, guild.name);
	}

	// ── consent and usage ──────────────────────────────────────────────────

	hasConsent(userId: string, version: string): boolean {
		return Boolean(this.getDb().prepare("SELECT 1 FROM consents WHERE user_id = ? AND version = ?").get(userId, version));
	}

	saveConsent(userId: string, version: string): void {
		this.getDb().prepare("INSERT OR IGNORE INTO consents (user_id, version, accepted_at) VALUES (?, ?, ?)").run(userId, version, now());
	}

	getUsage(userId: string, day: string): number {
		const row = this.getDb().prepare("SELECT units FROM usage_daily WHERE user_id = ? AND day = ?").get(userId, day) as unknown as
			| { units: number }
			| undefined;
		return row?.units ?? 0;
	}

	addUsage(userId: string, day: string, add: { units: number; promptTokens: number; cachedTokens: number; completionTokens: number }): void {
		this.getDb()
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

	/** usage for the requested days (a day with no row just doesn't appear). */
	getUsageDays(userId: string, days: string[]): DayUsage[] {
		if (!days.length) return [];
		const rows = this.getDb()
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

	// ── staff ──────────────────────────────────────────────────────────────

	/** searches by conversation id, user id, user name or title. */
	searchConversations(query: string, limit = 100): ConversationSummary[] {
		const q = query.trim();
		const like = `%${q.replace(/[%_\\]/g, "\\$&")}%`;
		const rows = this.getDb()
			.prepare(
				`SELECT c.*, (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) AS message_count
				 FROM conversations c
				 WHERE ? = '' OR c.id = ? OR c.user_id = ? OR c.user_name LIKE ? ESCAPE '\\' OR c.title LIKE ? ESCAPE '\\'
				 ORDER BY c.updated_at DESC LIMIT ?`,
			)
			.all(q, q, q, like, like, limit) as unknown as (ConversationRow & { message_count: number })[];
		return rows.map((r) => ({ ...toConversation(r), messageCount: r.message_count }));
	}

	/** deletes the conversation with its messages and proposals (ON DELETE CASCADE). */
	deleteConversation(id: string): boolean {
		const result = this.getDb().prepare("DELETE FROM conversations WHERE id = ?").run(id);
		return Number(result.changes) === 1;
	}

	logStaffAction(input: {
		staffId: string;
		action: "search" | "read" | "delete";
		conversationId?: string | null;
		targetUserId?: string | null;
		detail?: string | null;
	}): void {
		this.getDb()
			.prepare("INSERT INTO staff_audit (staff_id, action, conversation_id, target_user_id, detail, at) VALUES (?, ?, ?, ?, ?, ?)")
			.run(input.staffId, input.action, input.conversationId ?? null, input.targetUserId ?? null, input.detail ?? null, now());
	}
}

export const chatRepository = new ChatRepository();
