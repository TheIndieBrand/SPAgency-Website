import type { DatabaseSync } from "node:sqlite";
import { changelogRepository } from "./ChangelogRepository";
import { getApprovedComment } from "./community-testimonials";
import { openDatabase } from "./sqlite";
import { testimonials } from "./testimonials";

// "Me gusta" de la web: a los testimonios (los de siempre y los de la comunidad,
// solo en /testimonios) y a las entradas del changelog. Un solo mecanismo para
// todo: cada cosa que se puede gustar tiene un TARGET de texto con su espacio de
// nombres, y un usuario da como mucho un me gusta a cada uno.
//
//   testimonial:curated:<ID de Discord>   un testimonio elegido a mano (src/lib/testimonials.ts)
//   testimonial:community:<id>            un comentario de la comunidad ya aprobado
//   changelog:<id>                        una entrada publicada del changelog

export const likeTarget = {
	curated: (discordId: string) => `testimonial:curated:${discordId}`,
	community: (id: number) => `testimonial:community:${id}`,
	changelog: (id: number) => `changelog:${id}`,
};

export interface LikeState {
	count: number;
	liked: boolean;
}

let db: DatabaseSync | null = null;

function getDb(): DatabaseSync {
	if (db) return db;

	db = openDatabase("LIKES_DB_PATH", "data/likes.db");
	db.exec(`
		CREATE TABLE IF NOT EXISTS likes (
			target TEXT NOT NULL,
			user_id TEXT NOT NULL,
			created_at TEXT NOT NULL,
			PRIMARY KEY (target, user_id)
		);
		CREATE INDEX IF NOT EXISTS likes_user ON likes (user_id);
	`);
	return db;
}

// Comprueba que el target existe y se puede gustar (los borradores del changelog
// y lo no aprobado no). Devuelve el dueño, para no dejar gustarse a uno mismo,
// o null si no vale.
export function resolveTarget(target: string): { ownerId: string | null } | null {
	const match = /^(testimonial:curated|testimonial:community|changelog):(\d{1,25})$/.exec(target);
	if (!match) return null;

	const [, kind, key] = match;

	if (kind === "testimonial:curated") {
		const found = testimonials.find((t) => t.userId === key);
		return found ? { ownerId: found.userId } : null;
	}

	if (kind === "testimonial:community") {
		const comment = getApprovedComment(Number(key));
		return comment ? { ownerId: comment.userId } : null;
	}

	const entry = changelogRepository.getChangelogById(Number(key));
	return entry?.published ? { ownerId: null } : null;
}

// Da o quita el me gusta (alterna) y devuelve el estado nuevo.
export function toggleLike(target: string, userId: string): LikeState {
	const d = getDb();
	const existing = d.prepare("SELECT 1 FROM likes WHERE target = ? AND user_id = ?").get(target, userId);

	if (existing) d.prepare("DELETE FROM likes WHERE target = ? AND user_id = ?").run(target, userId);
	else d.prepare("INSERT INTO likes (target, user_id, created_at) VALUES (?, ?, ?)").run(target, userId, new Date().toISOString());

	const { n } = d.prepare("SELECT COUNT(*) AS n FROM likes WHERE target = ?").get(target) as { n: number };
	return { count: n, liked: !existing };
}

// Estado de todos los targets de un espacio de nombres (p. ej. "changelog:"),
// para pintar una página entera con una sola consulta. `viewerId` es quien mira
// (o undefined si no hay sesión).
export function likeStates(prefix: string, viewerId?: string): Map<string, LikeState> {
	const rows = getDb()
		.prepare(
			`SELECT target, COUNT(*) AS n, COALESCE(SUM(user_id = ?), 0) AS mine
			 FROM likes WHERE substr(target, 1, ?) = ? GROUP BY target`,
		)
		.all(viewerId ?? "", prefix.length, prefix) as unknown as Array<{ target: string; n: number; mine: number }>;

	return new Map(rows.map((r) => [r.target, { count: r.n, liked: r.mine > 0 }]));
}

export const noLikes: LikeState = { count: 0, liked: false };
