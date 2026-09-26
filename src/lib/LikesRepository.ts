import type { DatabaseSync } from "node:sqlite";
import { changelogRepository } from "./ChangelogRepository";
import { communityTestimonialsRepository } from "./CommunityTestimonialsRepository";
import { openDatabase } from "./sqlite";
import { testimonials } from "./testimonials";

// the site's likes: on testimonials (both the curated ones and the
// community's, the latter only on /testimonios) and on changelog entries. one
// mechanism for all of it: everything likeable has a text TARGET with its own
// namespace, and a user can like each one at most once.
//
//   testimonial:curated:<discord id>   a hand-picked testimonial (src/lib/testimonials.ts)
//   testimonial:community:<id>         an already-approved community comment
//   changelog:<id>                     a published changelog entry

export const likeTarget = {
	curated: (discordId: string) => `testimonial:curated:${discordId}`,
	community: (id: number) => `testimonial:community:${id}`,
	changelog: (id: number) => `changelog:${id}`,
};

export interface LikeState {
	count: number;
	liked: boolean;
}

export const noLikes: LikeState = { count: 0, liked: false };

/** the site's likes, stored in a local sqlite database keyed by target and user. */
export class LikesRepository {
	private database: DatabaseSync | null = null;

	private getDb(): DatabaseSync {
		if (this.database) return this.database;

		const db = openDatabase("LIKES_DB_PATH", "data/likes.db");
		db.exec(`
			CREATE TABLE IF NOT EXISTS likes (
				target TEXT NOT NULL,
				user_id TEXT NOT NULL,
				created_at TEXT NOT NULL,
				PRIMARY KEY (target, user_id)
			);
			CREATE INDEX IF NOT EXISTS likes_user ON likes (user_id);
		`);
		this.database = db;
		return db;
	}

	/**
	 * checks that a target exists and can be liked (changelog drafts and
	 * unapproved comments can't). returns its owner, so a user can't like
	 * their own thing, or null if it's not valid.
	 */
	resolveTarget(target: string): { ownerId: string | null } | null {
		const match = /^(testimonial:curated|testimonial:community|changelog):(\d{1,25})$/.exec(target);
		if (!match) return null;

		const [, kind, key] = match;

		if (kind === "testimonial:curated") {
			const found = testimonials.find((t) => t.userId === key);
			return found ? { ownerId: found.userId } : null;
		}

		if (kind === "testimonial:community") {
			const comment = communityTestimonialsRepository.getApprovedComment(Number(key));
			return comment ? { ownerId: comment.userId } : null;
		}

		const entry = changelogRepository.getChangelogById(Number(key));
		return entry?.published ? { ownerId: null } : null;
	}

	/** gives or removes the like (toggles it) and returns the new state. */
	toggleLike(target: string, userId: string): LikeState {
		const d = this.getDb();
		const existing = d.prepare("SELECT 1 FROM likes WHERE target = ? AND user_id = ?").get(target, userId);

		if (existing) d.prepare("DELETE FROM likes WHERE target = ? AND user_id = ?").run(target, userId);
		else d.prepare("INSERT INTO likes (target, user_id, created_at) VALUES (?, ?, ?)").run(target, userId, new Date().toISOString());

		const { n } = d.prepare("SELECT COUNT(*) AS n FROM likes WHERE target = ?").get(target) as { n: number };
		return { count: n, liked: !existing };
	}

	/**
	 * state of every target in a namespace (e.g. "changelog:"), to render a
	 * whole page with a single query. `viewerId` is whoever is looking (or
	 * undefined if there's no session).
	 */
	likeStates(prefix: string, viewerId?: string): Map<string, LikeState> {
		const rows = this.getDb()
			.prepare(`SELECT target, COUNT(*) AS n, COALESCE(SUM(user_id = ?), 0) AS mine FROM likes WHERE substr(target, 1, ?) = ? GROUP BY target`)
			.all(viewerId ?? "", prefix.length, prefix) as unknown as Array<{ target: string; n: number; mine: number }>;

		return new Map(rows.map((r) => [r.target, { count: r.n, liked: r.mine > 0 }]));
	}
}

export const likesRepository = new LikesRepository();
