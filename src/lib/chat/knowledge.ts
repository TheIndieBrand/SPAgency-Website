import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { slugify } from "../docs";
import { listChangelogs } from "../changelog";
import { CONTEXT_CHARS } from "./config";

// Búsqueda sobre la web en Markdown (knowledge/, generada con `pnpm knowledge`).
// Es recuperación clásica (BM25) hecha en el servidor, sin llamadas al modelo y
// sin embeddings: para cada pregunta se eligen 2-3 fragmentos y solo esos viajan
// en el prompt. El corpus es pequeño (unos 100 fragmentos), así que sobra.

export interface Chunk {
	title: string; // página
	heading: string; // sección dentro de la página ("" = introducción)
	url: string; // con ancla cuando la sección tiene una
	text: string;
	terms: Map<string, number>;
	length: number;
}

const MAX_PART_CHARS = 800;

// Palabras vacías del español + las que más aparecen en las preguntas a un bot.
const STOP = new Set(
	`a al algo ante aqui asi aun aunque cada como con cual cuando de del desde donde dos el ella ellos en entre era es esa ese eso esta este esto estoy fue ha hace hacer han hasta hay la las le les lo los mas me mi mis mucho muy no nos nosotros o os otra otro para pero poco por porque puedo puede pueden que quien quiero se si sin sobre son su sus tambien te tengo ti tiene tu tus un una uno unos y ya yo hola gracias por favor quiero necesito podria saber`.split(
		/\s+/,
	),
);

// Normaliza y recorta cada palabra a una raíz aproximada, para que "banear",
// "baneado" y "baneo" (o "bots" y "bot") coincidan. No es un stemmer completo, y
// no hace falta: solo tiene que agrupar lo bastante para un corpus tan pequeño.
export function tokenize(text: string): string[] {
	const words = text
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.toLowerCase()
		.match(/[a-z0-9]+/g);

	return (words ?? [])
		.filter((w) => w.length > 1 && !STOP.has(w))
		.map((w) => {
			let s = w;
			if (s.length > 3) s = s.replace(/(aciones|iciones|ciones|cion|amiento|ando|iendo|ados|idos|ado|ido|ar|er|ir|es|s)$/, "");
			if (s.length > 4) s = s.replace(/[aeo]$/, "");
			return s;
		});
}

function countTerms(tokens: string[], boost: string[] = []): Map<string, number> {
	const terms = new Map<string, number>();
	for (const t of tokens) terms.set(t, (terms.get(t) ?? 0) + 1);
	// Lo que aparece en el título o el encabezado pesa más (x3).
	for (const t of boost) terms.set(t, (terms.get(t) ?? 0) + 3);
	return terms;
}

function makeChunk(title: string, heading: string, url: string, text: string): Chunk {
	const terms = countTerms(tokenize(text), tokenize(`${title} ${heading}`));
	return { title, heading, url, text, terms, length: [...terms.values()].reduce((a, b) => a + b, 0) };
}

// Parte un texto largo en trozos pequeños, cortando por líneas. Trozos pequeños
// puntúan con más precisión (una tabla de 14 filas diluiría cada fila) y cuestan
// menos al inyectarse. Si el texto empieza con una tabla, cada trozo repite su
// cabecera para que las filas sigan teniendo sentido.
function splitLong(text: string): string[] {
	if (text.length <= MAX_PART_CHARS) return [text];

	const lines = text.split("\n");
	const tableHeader = lines[0]?.startsWith("|") && /^\|[\s|:-]+\|$/.test(lines[1] ?? "") ? `${lines[0]}\n${lines[1]}` : "";
	const parts: string[] = [];
	let current = "";
	for (const line of lines) {
		if (current && current.length + line.length > MAX_PART_CHARS) {
			parts.push(current);
			current = tableHeader && line.startsWith("|") ? tableHeader : "";
		}
		current += `${current ? "\n" : ""}${line}`;
	}
	if (current) parts.push(current);
	return parts;
}

interface Page {
	title: string;
	url: string;
	kind: string;
	body: string;
}

function parsePage(source: string): Page | null {
	const match = source.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
	if (!match) return null;
	const meta = Object.fromEntries(
		match[1].split("\n").map((line) => {
			const i = line.indexOf(":");
			return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
		}),
	);
	if (!meta.title || !meta.url) return null;
	// Sin el "# Título" inicial (ya va en los metadatos).
	return { title: meta.title, url: meta.url, kind: meta.kind ?? "", body: match[2].replace(/^\s*# .*\n/, "") };
}

function chunkPage(page: Page): Chunk[] {
	const chunks: Chunk[] = [];
	const [intro, ...sections] = page.body.split(/\n## /);

	const add = (heading: string, text: string) => {
		const url = heading && page.kind === "docs" ? `${page.url}#${slugify(heading)}` : page.url;
		for (const part of splitLong(text.trim())) if (part) chunks.push(makeChunk(page.title, heading, url, part));
	};

	add("", intro);
	for (const section of sections) {
		const newline = section.indexOf("\n");
		add(section.slice(0, newline === -1 ? undefined : newline).trim(), section);
	}
	return chunks;
}

// ── Índice en memoria ───────────────────────────────────────────────────────

const knowledgeDir = () => resolve(process.env.KNOWLEDGE_DIR || "knowledge");

interface Index {
	chunks: Chunk[];
	sitemap: string;
	stamp: number;
}

let index: Index | null = null;
let lastCheck = 0;
let changelogChunks: Chunk[] = [];
let changelogLoadedAt = 0;

function sourceStamp(dir: string): number {
	return readdirSync(dir).reduce((max, file) => Math.max(max, statSync(join(dir, file)).mtimeMs), 0);
}

// El changelog vive en SQLite y cambia sin desplegar: se relee cada 5 minutos.
function loadChangelog(): Chunk[] {
	if (Date.now() - changelogLoadedAt < 5 * 60_000) return changelogChunks;
	changelogLoadedAt = Date.now();
	try {
		changelogChunks = listChangelogs()
			.slice(0, 8)
			.flatMap((entry) => {
				const heading = [entry.name, entry.version].filter(Boolean).join(" ") || entry.title;
				return splitLong(entry.markdown.trim()).map((part) => makeChunk("Changelog", heading, `/changelog/${entry.slug}`, part));
			});
	} catch {
		changelogChunks = [];
	}
	return changelogChunks;
}

function build(dir: string, stamp: number): Index {
	const chunks: Chunk[] = [];
	for (const file of readdirSync(dir)) {
		if (!file.endsWith(".md") || file.startsWith("_")) continue;
		const page = parsePage(readFileSync(join(dir, file), "utf8"));
		if (page) chunks.push(...chunkPage(page));
	}

	const sitemapFile = join(dir, "_sitemap.md");
	return {
		chunks,
		sitemap: existsSync(sitemapFile) ? readFileSync(sitemapFile, "utf8").trim() : "",
		stamp,
	};
}

function ensureIndex(): Index | null {
	const dir = knowledgeDir();
	if (!existsSync(dir)) return null;

	// Se comprueba si hay cambios como mucho cada 5 s (en desarrollo, para no
	// reiniciar al regenerar; en producción no cambia nada).
	if (!index || Date.now() - lastCheck > 5000) {
		lastCheck = Date.now();
		const stamp = sourceStamp(dir);
		if (!index || index.stamp !== stamp) index = build(dir, stamp);
	}
	return index;
}

export function knowledgeReady(): boolean {
	return ensureIndex() !== null;
}

// Lista de páginas (título y ruta) para el prompt de sistema.
export function siteMap(): string {
	return ensureIndex()?.sitemap ?? "";
}

export interface Hit {
	title: string;
	heading: string;
	url: string;
	text: string;
	score: number;
}

const K1 = 1.4;
const B = 0.75;
const MIN_SCORE = 2.5; // por debajo, no hay nada relevante: mejor no inyectar ruido

export function search(query: string, limit: number): Hit[] {
	const base = ensureIndex();
	if (!base) return [];

	const chunks = [...base.chunks, ...loadChangelog()];
	const queryTerms = [...new Set(tokenize(query))];
	if (!queryTerms.length || !chunks.length) return [];

	const docFreq = new Map<string, number>();
	let totalLength = 0;
	for (const chunk of chunks) {
		totalLength += chunk.length;
		for (const term of chunk.terms.keys()) docFreq.set(term, (docFreq.get(term) ?? 0) + 1);
	}
	const avgLength = totalLength / chunks.length;

	const scored = chunks.map((chunk) => {
		let score = 0;
		for (const term of queryTerms) {
			const tf = chunk.terms.get(term);
			if (!tf) continue;
			const n = docFreq.get(term) ?? 0;
			const idf = Math.log(1 + (chunks.length - n + 0.5) / (n + 0.5));
			score += (idf * tf * (K1 + 1)) / (tf + K1 * (1 - B + (B * chunk.length) / avgLength));
		}
		return { chunk, score };
	});

	const ranked = scored.filter((s) => s.score >= MIN_SCORE).sort((a, b) => b.score - a.score);
	const top = ranked[0]?.score ?? 0;

	return ranked
		.filter((s) => s.score >= top * 0.45)
		.slice(0, limit)
		.map(({ chunk, score }) => ({
			title: chunk.title,
			heading: chunk.heading,
			url: chunk.url,
			text: chunk.text.length > CONTEXT_CHARS ? `${chunk.text.slice(0, CONTEXT_CHARS)}…` : chunk.text,
			score,
		}));
}

// Rutas reales de la web con su título, para que el chat convierta en botón solo
// las que existen (una ruta inventada por el modelo se queda como texto).
export function siteRoutes(): Record<string, string> {
	const routes: Record<string, string> = { "/docs": "Documentación", "/support/assistant": "Asistente de IA", "/dashboard": "Dashboard" };
	for (const line of siteMap().split("\n")) {
		const match = /^- (.*) \((\/[^)]*)\)$/.exec(line);
		if (match && !routes[match[2]]) routes[match[2]] = match[1];
	}
	return routes;
}
