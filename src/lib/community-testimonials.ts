import type { DatabaseSync } from "node:sqlite";
import { openDatabase } from "./sqlite";
import { testimonials as curatedTestimonials } from "./testimonials";

// Comentarios de la comunidad sobre el bot (/testimonios). Los escribe cualquiera
// con sesión de Discord y NO se ven hasta que el staff los aprueba. Nunca salen
// en el home: ahí solo van los testimonios elegidos a mano de src/lib/testimonials.ts.

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

export const MIN_LENGTH = 20;
export const MAX_LENGTH = 400;

// Anti-spam: un solo comentario pendiente a la vez, una pausa entre envíos y un
// tope diario. El staff modera todo igualmente; esto evita llenarle la cola.
const COOLDOWN_MS = 60_000;
const DAILY_LIMIT = 3;

let db: DatabaseSync | null = null;

function getDb(): DatabaseSync {
	if (db) return db;

	db = openDatabase("TESTIMONIALS_DB_PATH", "data/testimonials.db");
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
	return db;
}

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

// Caracteres de control (menos el salto de línea) y de ancho cero o de dirección.
// Se construye desde códigos para que el fuente no lleve caracteres invisibles.
const STRIP_RANGES: Array<[number, number]> = [
	[0x00, 0x09],
	[0x0b, 0x1f],
	[0x7f, 0x7f],
	[0x200b, 0x200f],
	[0x2028, 0x202e],
	[0x2060, 0x2060],
	[0xfeff, 0xfeff],
];
const STRIP_CHARS = new RegExp(
	"[" + STRIP_RANGES.map(([from, to]) => String.fromCharCode(from) + "-" + String.fromCharCode(to)).join("") + "]",
	"g",
);

// Limpia el texto y lo valida. Es texto plano: sin markdown ni HTML (se pinta
// escapado). Devuelve el texto listo o un mensaje de error para el usuario.
export function normalizeComment(input: unknown): { ok: true; comment: string } | { ok: false; message: string } {
	if (typeof input !== "string") return { ok: false, message: "Escribe tu comentario." };

	const comment = input
		.normalize("NFC")
		.replace(STRIP_CHARS, "")
		.replace(/\r\n?/g, "\n")
		.replace(/\n{3,}/g, "\n\n")
		.trim();

	if (comment.length < MIN_LENGTH) return { ok: false, message: `Cuéntanos un poco más (mínimo ${MIN_LENGTH} caracteres).` };
	if (comment.length > MAX_LENGTH) return { ok: false, message: `Es demasiado largo (máximo ${MAX_LENGTH} caracteres).` };

	return { ok: true, comment };
}

// Quien ya tiene un testimonio PUBLICADO no puede enviar otro: o bien es uno de los
// elegidos a mano (los del home, identificados por su ID de Discord en
// src/lib/testimonials.ts) o bien tiene un comentario aprobado. Si el staff retira el
// suyo (queda rechazado), puede volver a escribir.
export function hasPublishedTestimonial(userId: string): boolean {
	if (curatedTestimonials.some((t) => t.userId === userId)) return true;
	return Boolean(getDb().prepare("SELECT 1 FROM community_testimonials WHERE user_id = ? AND status = 'approved'").get(userId));
}

// Un comentario aprobado por su id (los me gusta solo valen sobre lo publicado).
export function getApprovedComment(id: number): CommunityComment | null {
	const row = getDb()
		.prepare("SELECT * FROM community_testimonials WHERE id = ? AND status = 'approved'")
		.get(id) as unknown as Row | undefined;
	return row ? toComment(row) : null;
}

export type SubmitResult =
	| { ok: true; id: number }
	| { ok: false; error: "already_published" | "pending_exists" | "cooldown" | "daily_limit" };

export function submitComment(
	user: { id: string; username: string; displayName: string; avatar: string },
	comment: string,
): SubmitResult {
	const d = getDb();
	const now = Date.now();

	if (hasPublishedTestimonial(user.id)) return { ok: false, error: "already_published" };

	if (d.prepare("SELECT 1 FROM community_testimonials WHERE user_id = ? AND status = 'pending'").get(user.id)) {
		return { ok: false, error: "pending_exists" };
	}

	const last = d
		.prepare("SELECT created_at FROM community_testimonials WHERE user_id = ? ORDER BY created_at DESC LIMIT 1")
		.get(user.id) as { created_at: string } | undefined;
	if (last && now - Date.parse(last.created_at) < COOLDOWN_MS) return { ok: false, error: "cooldown" };

	const today = d
		.prepare("SELECT COUNT(*) AS n FROM community_testimonials WHERE user_id = ? AND created_at > ?")
		.get(user.id, new Date(now - 24 * 3600 * 1000).toISOString()) as { n: number };
	if (today.n >= DAILY_LIMIT) return { ok: false, error: "daily_limit" };

	const { lastInsertRowid } = d
		.prepare(
			"INSERT INTO community_testimonials (user_id, username, display_name, avatar, comment, created_at) VALUES (?, ?, ?, ?, ?, ?)",
		)
		.run(user.id, user.username, user.displayName, user.avatar, comment, new Date(now).toISOString());

	return { ok: true, id: Number(lastInsertRowid) };
}

// El último comentario de un usuario, para decirle en qué estado está.
export function latestForUser(userId: string): CommunityComment | null {
	const row = getDb()
		.prepare("SELECT * FROM community_testimonials WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 1")
		.get(userId) as unknown as Row | undefined;
	return row ? toComment(row) : null;
}

// Solo lo aprobado, lo más reciente primero: es lo único que ve el público.
export function listApproved(limit = 300): CommunityComment[] {
	const rows = getDb()
		.prepare("SELECT * FROM community_testimonials WHERE status = 'approved' ORDER BY reviewed_at DESC, id DESC LIMIT ?")
		.all(limit) as unknown as Row[];
	return rows.map(toComment);
}

export function listByStatus(status: CommentStatus, limit = 300): CommunityComment[] {
	const order = status === "pending" ? "created_at ASC" : "reviewed_at DESC";
	const rows = getDb()
		.prepare(`SELECT * FROM community_testimonials WHERE status = ? ORDER BY ${order}, id DESC LIMIT ?`)
		.all(status, limit) as unknown as Row[];
	return rows.map(toComment);
}

export function countPending(): number {
	return (getDb().prepare("SELECT COUNT(*) AS n FROM community_testimonials WHERE status = 'pending'").get() as { n: number }).n;
}

// Decisión del staff. Se guarda quién y cuándo. Devuelve false si no existe.
export function setStatus(id: number, status: CommentStatus, staffId: string): boolean {
	const { changes } = getDb()
		.prepare("UPDATE community_testimonials SET status = ?, reviewed_at = ?, reviewed_by = ? WHERE id = ?")
		.run(status, new Date().toISOString(), staffId, id);
	return changes > 0;
}
