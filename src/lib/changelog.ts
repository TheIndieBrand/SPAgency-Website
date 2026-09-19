import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { renderMarkdown } from "./changelog-markdown";

// Slugs que chocarían con rutas reales bajo /changelog/.
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

let db: DatabaseSync | null = null;

// Un solo archivo SQLite, que se crea solo en la primera consulta. En
// producción conviene apuntarlo (CHANGELOG_DB_PATH) a un disco que persista.
function getDb(): DatabaseSync {
	if (db) return db;

	const file = resolve(process.env.CHANGELOG_DB_PATH || "data/changelog.db");
	mkdirSync(dirname(file), { recursive: true });

	db = new DatabaseSync(file);
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
	return db;
}

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

function slugify(title: string): string {
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

// El slug es el enlace permanente: se genera una sola vez al crear la entrada
// y NO cambia al editar (ni siquiera si se cambia el título), para que los
// enlaces ya compartidos sigan funcionando.
function uniqueSlug(title: string): string {
	const base = slugify(title);
	const taken = getDb().prepare("SELECT 1 FROM changelog WHERE slug = ?");

	let slug = base;
	for (let n = 2; RESERVED_SLUGS.has(slug) || taken.get(slug); n++) slug = `${base}-${n}`;
	return slug;
}

const ORDER = "ORDER BY published_at DESC, id DESC";

export function listChangelogs({ includeDrafts = false } = {}): ChangelogEntry[] {
	const where = includeDrafts ? "" : "WHERE published = 1";
	const rows = getDb().prepare(`SELECT * FROM changelog ${where} ${ORDER}`).all() as unknown as Row[];
	return rows.map(toEntry);
}

// Vecinos publicados de una entrada (newer = la siguiente más reciente, older =
// la anterior) para los enlaces "anterior / siguiente" de su página. Un borrador
// no está en la lista publicada, así que no tiene vecinos ni cuenta como última.
export function getChangelogNeighbors(id: number): {
	newer: ChangelogEntry | null;
	older: ChangelogEntry | null;
	isLatest: boolean;
} {
	const list = listChangelogs();
	const i = list.findIndex((e) => e.id === id);
	if (i === -1) return { newer: null, older: null, isLatest: false };
	return { newer: list[i - 1] ?? null, older: list[i + 1] ?? null, isLatest: i === 0 };
}

export function getChangelogBySlug(slug: string): ChangelogEntry | null {
	const row = getDb().prepare("SELECT * FROM changelog WHERE slug = ?").get(slug) as unknown as Row | undefined;
	return row ? toEntry(row) : null;
}

export function getChangelogById(id: number): ChangelogEntry | null {
	const row = getDb().prepare("SELECT * FROM changelog WHERE id = ?").get(id) as unknown as Row | undefined;
	return row ? toEntry(row) : null;
}

export function createChangelog(input: ChangelogInput): ChangelogEntry {
	const now = new Date().toISOString();
	const slug = uniqueSlug(renderMarkdown(input.markdown).title);

	const { lastInsertRowid } = getDb()
		.prepare(
			"INSERT INTO changelog (slug, markdown, published, published_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
		)
		.run(slug, input.markdown, input.published ? 1 : 0, input.publishedAt, now, now);

	return getChangelogById(Number(lastInsertRowid))!;
}

export function updateChangelog(id: number, input: ChangelogInput): ChangelogEntry | null {
	const { changes } = getDb()
		.prepare("UPDATE changelog SET markdown = ?, published = ?, published_at = ?, updated_at = ? WHERE id = ?")
		.run(input.markdown, input.published ? 1 : 0, input.publishedAt, new Date().toISOString(), id);

	return changes ? getChangelogById(id) : null;
}

export function deleteChangelog(id: number): boolean {
	return getDb().prepare("DELETE FROM changelog WHERE id = ?").run(id).changes > 0;
}

// "2026-09-19" → "19 de septiembre de 2026". Se fija UTC para que la fecha no
// se desplace un día según la zona horaria del servidor.
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
