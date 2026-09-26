import type { DatabaseSync } from "node:sqlite";
import { openDatabase } from "./sqlite";
import { renderMarkdown } from "./changelog-markdown";

// slugs that would collide with real routes under /changelog/.
const RESERVED_SLUGS = new Set(["admin"]);

interface Row {
	id: number;
	slug: string;
	markdown: string;
	published: number;
	published_at: string;
	updated_at: string;
}

export interface ChangelogEntry {
	id: number;
	slug: string;
	markdown: string;
	published: boolean;
	publishedAt: string;
	updatedAt: string;
	title: string;
	name: string;
	version: string;
	subtitle: string;
	html: string;
}

export interface ChangelogInput {
	markdown: string;
	publishedAt: string;
	published: boolean;
}

const OrderByLatest = "ORDER BY published_at DESC, id DESC";

function toEntry(row: Row): ChangelogEntry {
	const { title, name, version, subtitle, html } = renderMarkdown(row.markdown);
	return {
		id: row.id,
		slug: row.slug,
		markdown: row.markdown,
		published: row.published === 1,
		publishedAt: row.published_at,
		updatedAt: row.updated_at,
		title,
		name,
		version,
		subtitle,
		html,
	};
}

/**
 * the changelog's own storage: a single sqlite database, created on first
 * query. in production, point it (CHANGELOG_DB_PATH) at a disk that persists.
 */
export class ChangelogRepository {
	private database: DatabaseSync | null = null;

	private getDb(): DatabaseSync {
		if (this.database) return this.database;

		const db = openDatabase("CHANGELOG_DB_PATH", "data/changelog.db");
		db.exec(`
			CREATE TABLE IF NOT EXISTS changelog (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				slug TEXT NOT NULL UNIQUE,
				markdown TEXT NOT NULL,
				published INTEGER NOT NULL DEFAULT 0,
				published_at TEXT NOT NULL,
				created_at TEXT NOT NULL,
				updated_at TEXT NOT NULL
			)
		`);
		this.database = db;
		return db;
	}

	private slugify(title: string): string {
		const slug = title
			.normalize("NFD")
			.replace(/[̀-ͯ]/g, "")
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "")
			.slice(0, 80)
			.replace(/-+$/g, "");
		return slug || "entrada";
	}

	/**
	 * the slug is the permalink: generated once when the entry is created and
	 * it does NOT change on edit (not even if the title changes), so links
	 * already shared keep working.
	 */
	private uniqueSlug(title: string): string {
		const base = this.slugify(title);
		const taken = this.getDb().prepare("SELECT 1 FROM changelog WHERE slug = ?");

		let slug = base;
		for (let n = 2; RESERVED_SLUGS.has(slug) || taken.get(slug); n++) slug = `${base}-${n}`;
		return slug;
	}

	listChangelogs({ includeDrafts = false } = {}): ChangelogEntry[] {
		const where = includeDrafts ? "" : "WHERE published = 1";
		const rows = this.getDb().prepare(`SELECT * FROM changelog ${where} ${OrderByLatest}`).all() as unknown as Row[];
		return rows.map(toEntry);
	}

	/**
	 * an entry's published neighbors (newer = the next most recent, older =
	 * the previous one) for its page's "previous / next" links. a draft isn't
	 * in the published list, so it has no neighbors and doesn't count as latest.
	 */
	getChangelogNeighbors(id: number): { newer: ChangelogEntry | null; older: ChangelogEntry | null; isLatest: boolean } {
		const list = this.listChangelogs();
		const i = list.findIndex((e) => e.id === id);
		if (i === -1) return { newer: null, older: null, isLatest: false };
		return { newer: list[i - 1] ?? null, older: list[i + 1] ?? null, isLatest: i === 0 };
	}

	getChangelogBySlug(slug: string): ChangelogEntry | null {
		const row = this.getDb().prepare("SELECT * FROM changelog WHERE slug = ?").get(slug) as unknown as Row | undefined;
		return row ? toEntry(row) : null;
	}

	getChangelogById(id: number): ChangelogEntry | null {
		const row = this.getDb().prepare("SELECT * FROM changelog WHERE id = ?").get(id) as unknown as Row | undefined;
		return row ? toEntry(row) : null;
	}

	createChangelog(input: ChangelogInput): ChangelogEntry {
		const now = new Date().toISOString();
		const slug = this.uniqueSlug(renderMarkdown(input.markdown).title);

		const { lastInsertRowid } = this.getDb()
			.prepare("INSERT INTO changelog (slug, markdown, published, published_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
			.run(slug, input.markdown, input.published ? 1 : 0, input.publishedAt, now, now);

		return this.getChangelogById(Number(lastInsertRowid))!;
	}

	updateChangelog(id: number, input: ChangelogInput): ChangelogEntry | null {
		const { changes } = this.getDb()
			.prepare("UPDATE changelog SET markdown = ?, published = ?, published_at = ?, updated_at = ? WHERE id = ?")
			.run(input.markdown, input.published ? 1 : 0, input.publishedAt, new Date().toISOString(), id);

		return changes ? this.getChangelogById(id) : null;
	}

	deleteChangelog(id: number): boolean {
		return this.getDb().prepare("DELETE FROM changelog WHERE id = ?").run(id).changes > 0;
	}
}

export const changelogRepository = new ChangelogRepository();

/** "2026-09-19" → "19 de septiembre de 2026". fixed to utc so the date doesn't shift a day depending on the server's time zone. */
export function formatChangelogDate(isoDate: string): string {
	return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString("es-ES", {
		day: "numeric",
		month: "long",
		year: "numeric",
		timeZone: "UTC",
	});
}

export function todayIso(): string {
	return new Date().toISOString().slice(0, 10);
}
