import type { DatabaseSync } from "node:sqlite";
import { openDatabase } from "./sqlite";
import { testimonials as curatedTestimonials } from "./testimonials";
import { DailySubmissionLimit, MaxCommentLength, MinCommentLength, SubmissionCooldownMs } from "./CommunityTestimonials.constants";

// community comments about the bot (/testimonios). anyone with a discord
// session can write one, and they're NOT shown until staff approves them.
// they never appear on the home page: that only shows the hand-picked
// testimonials from src/lib/testimonials.ts.

export type CommentStatus = "pending" | "approved" | "rejected";

export interface CommunityComment {
	id: number;
	userId: string;
	username: string;
	displayName: string;
	avatar: string;
	comment: string;
	status: CommentStatus;
	createdAt: string;
	reviewedAt: string | null;
	reviewedBy: string | null;
}

interface Row {
	id: number;
	user_id: string;
	username: string;
	display_name: string;
	avatar: string;
	comment: string;
	status: string;
	created_at: string;
	reviewed_at: string | null;
	reviewed_by: string | null;
}

export type SubmitResult = { ok: true; id: number } | { ok: false; error: "already_published" | "pending_exists" | "cooldown" | "daily_limit" };

// control characters (except newline), zero-width and direction characters.
// built from character codes so the source itself carries no invisible characters.
const STRIP_RANGES: Array<[number, number]> = [
	[0x00, 0x09],
	[0x0b, 0x1f],
	[0x7f, 0x7f],
	[0x200b, 0x200f],
	[0x2028, 0x202e],
	[0x2060, 0x2060],
	[0xfeff, 0xfeff],
];
const STRIP_CHARS = new RegExp("[" + STRIP_RANGES.map(([from, to]) => String.fromCharCode(from) + "-" + String.fromCharCode(to)).join("") + "]", "g");

function toComment(row: Row): CommunityComment {
	return {
		id: row.id,
		userId: row.user_id,
		username: row.username,
		displayName: row.display_name,
		avatar: row.avatar,
		comment: row.comment,
		status: row.status as CommentStatus,
		createdAt: row.created_at,
		reviewedAt: row.reviewed_at,
		reviewedBy: row.reviewed_by,
	};
}

/**
 * cleans and validates a comment. plain text: no markdown or html (it's
 * rendered escaped). returns the ready text, or an error message for the user.
 */
export function normalizeComment(input: unknown): { ok: true; comment: string } | { ok: false; message: string } {
	if (typeof input !== "string") return { ok: false, message: "Escribe tu comentario." };

	const comment = input
		.normalize("NFC")
		.replace(STRIP_CHARS, "")
		.replace(/\r\n?/g, "\n")
		.replace(/\n{3,}/g, "\n\n")
		.trim();

	if (comment.length < MinCommentLength) return { ok: false, message: `Cuéntanos un poco más (mínimo ${MinCommentLength} caracteres).` };
	if (comment.length > MaxCommentLength) return { ok: false, message: `Es demasiado largo (máximo ${MaxCommentLength} caracteres).` };

	return { ok: true, comment };
}

/**
 * community testimonial submissions: pending, approved and rejected
 * comments, stored in a local sqlite database. anti-spam is enforced here
 * (one pending comment at a time, a cooldown, a daily cap) — staff still
 * moderates everything, this just keeps their queue from filling up.
 */
export class CommunityTestimonialsRepository {
	private database: DatabaseSync | null = null;

	private getDb(): DatabaseSync {
		if (this.database) return this.database;

		const db = openDatabase("TESTIMONIALS_DB_PATH", "data/testimonials.db");
		db.exec(`
			CREATE TABLE IF NOT EXISTS community_testimonials (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				user_id TEXT NOT NULL,
				username TEXT NOT NULL,
				display_name TEXT NOT NULL,
				avatar TEXT NOT NULL,
				comment TEXT NOT NULL,
				status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
				created_at TEXT NOT NULL,
				reviewed_at TEXT,
				reviewed_by TEXT
			);
			CREATE INDEX IF NOT EXISTS community_testimonials_status ON community_testimonials (status, created_at);
			CREATE INDEX IF NOT EXISTS community_testimonials_user ON community_testimonials (user_id, created_at);
		`);
		this.database = db;
		return db;
	}

	/**
	 * whether the user already has a PUBLISHED testimonial: either one of the
	 * hand-picked ones (the home page's, identified by their discord id in
	 * src/lib/testimonials.ts) or an approved comment. if staff withdraws
	 * theirs (it becomes rejected), they can submit again.
	 */
	hasPublishedTestimonial(userId: string): boolean {
		if (curatedTestimonials.some((t) => t.userId === userId)) return true;
		return Boolean(this.getDb().prepare("SELECT 1 FROM community_testimonials WHERE user_id = ? AND status = 'approved'").get(userId));
	}

	/** an approved comment by its id (likes only apply to what's published). */
	getApprovedComment(id: number): CommunityComment | null {
		const row = this.getDb().prepare("SELECT * FROM community_testimonials WHERE id = ? AND status = 'approved'").get(id) as unknown as Row | undefined;
		return row ? toComment(row) : null;
	}

	submitComment(user: { id: string; username: string; displayName: string; avatar: string }, comment: string): SubmitResult {
		const d = this.getDb();
		const now = Date.now();

		if (this.hasPublishedTestimonial(user.id)) return { ok: false, error: "already_published" };

		if (d.prepare("SELECT 1 FROM community_testimonials WHERE user_id = ? AND status = 'pending'").get(user.id)) {
			return { ok: false, error: "pending_exists" };
		}

		const last = d
			.prepare("SELECT created_at FROM community_testimonials WHERE user_id = ? ORDER BY created_at DESC LIMIT 1")
			.get(user.id) as { created_at: string } | undefined;
		if (last && now - Date.parse(last.created_at) < SubmissionCooldownMs) return { ok: false, error: "cooldown" };

		const today = d
			.prepare("SELECT COUNT(*) AS n FROM community_testimonials WHERE user_id = ? AND created_at > ?")
			.get(user.id, new Date(now - 24 * 3600 * 1000).toISOString()) as { n: number };
		if (today.n >= DailySubmissionLimit) return { ok: false, error: "daily_limit" };

		const { lastInsertRowid } = d
			.prepare("INSERT INTO community_testimonials (user_id, username, display_name, avatar, comment, created_at) VALUES (?, ?, ?, ?, ?, ?)")
			.run(user.id, user.username, user.displayName, user.avatar, comment, new Date(now).toISOString());

		return { ok: true, id: Number(lastInsertRowid) };
	}

	/** a user's latest comment, to tell them what state it's in. */
	latestForUser(userId: string): CommunityComment | null {
		const row = this.getDb()
			.prepare("SELECT * FROM community_testimonials WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 1")
			.get(userId) as unknown as Row | undefined;
		return row ? toComment(row) : null;
	}

	/** only approved comments, most recent first: the only ones the public sees. */
	listApproved(limit = 300): CommunityComment[] {
		const rows = this.getDb()
			.prepare("SELECT * FROM community_testimonials WHERE status = 'approved' ORDER BY reviewed_at DESC, id DESC LIMIT ?")
			.all(limit) as unknown as Row[];
		return rows.map(toComment);
	}

	listByStatus(status: CommentStatus, limit = 300): CommunityComment[] {
		const order = status === "pending" ? "created_at ASC" : "reviewed_at DESC";
		const rows = this.getDb()
			.prepare(`SELECT * FROM community_testimonials WHERE status = ? ORDER BY ${order}, id DESC LIMIT ?`)
			.all(status, limit) as unknown as Row[];
		return rows.map(toComment);
	}

	countPending(): number {
		return (this.getDb().prepare("SELECT COUNT(*) AS n FROM community_testimonials WHERE status = 'pending'").get() as { n: number }).n;
	}

	/** staff's decision. records who and when. returns false if it doesn't exist. */
	setStatus(id: number, status: CommentStatus, staffId: string): boolean {
		const { changes } = this.getDb()
			.prepare("UPDATE community_testimonials SET status = ?, reviewed_at = ?, reviewed_by = ? WHERE id = ?")
			.run(status, new Date().toISOString(), staffId, id);
		return changes > 0;
	}
}

export const communityTestimonialsRepository = new CommunityTestimonialsRepository();
