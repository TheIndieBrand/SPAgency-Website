// Genera en knowledge/ una versión en Markdown de toda la web, para el asistente
// de IA. Se ejecuta con `pnpm knowledge` (y solo antes de `dev` y `build`).
//
// No hay nada que mantener a mano: lee las mismas fuentes que pintan las páginas
//   · docs        → src/lib/docs (datos)
//   · home        → src/lib/home-content.ts, steps.ts, site.ts (datos)
//   · dashboard   → los propios .astro de src/pages/dashboard (se extraen los
//                   títulos, interruptores y campos de cada ajuste)
//   · el resto de páginas públicas → se descubren solas recorriendo src/pages
//                   (términos, privacidad, testimonios…); una página nueva entra
//                   sin tocar este script
// así que cada cambio de la web llega al asistente con solo volver a ejecutarlo.
// El changelog no pasa por aquí: vive en SQLite y el asistente lo lee en vivo.
//
// Los .ts se importan con el type-stripping de Node (lo activa el script del
// package.json), sin dependencias extra.

import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "..");
const out = join(root, "knowledge");
const load = (path) => import(pathToFileURL(join(root, path)).href);

const { docGroups, docPages } = await load("src/lib/docs/index.ts");
const { site } = await load("src/lib/site.ts");
const home = await load("src/lib/home-content.ts");
const { steps } = await load("src/lib/steps.ts");

const files = new Map(); // nombre de archivo → contenido
const sitemap = []; // { title, url, summary }

function page({ file, title, url, summary, kind, body }) {
	const head = `---\ntitle: ${title}\nurl: ${url}\nkind: ${kind}\n---\n\n# ${title}\n${summary ? `\n> ${summary}\n` : ""}\n`;
	files.set(file, `${head}${body.trim()}\n`);
	sitemap.push({ title, url, summary });
}

// ── Docs ────────────────────────────────────────────────────────────────────

function blockToMarkdown(block) {
	switch (block.type) {
		case "p":
			return block.text;
		case "h":
			return `## ${block.text}`;
		case "list":
			return block.items.map((item, i) => `${block.ordered ? `${i + 1}.` : "-"} ${item}`).join("\n");
		case "callout":
			return `> **${block.title ?? { info: "Nota", tip: "Consejo", warning: "Aviso" }[block.tone]}.** ${block.text}`;
		case "table": {
			const row = (cells) => `| ${cells.map((c) => c.replace(/\|/g, "\\|")).join(" | ")} |`;
			return [row(block.head), row(block.head.map(() => "---")), ...block.rows.map(row)].join("\n");
		}
	}
}

for (const doc of docPages) {
	page({
		file: `docs-${doc.slug}.md`,
		title: doc.title,
		url: `/docs/${doc.slug}`,
		summary: doc.summary,
		kind: "docs",
		body: doc.blocks.map(blockToMarkdown).join("\n\n"),
	});
}

// ── Web pública ─────────────────────────────────────────────────────────────

const homeBody = [
	home.hero.subtitle,
	`## ${home.sections.features.title}\n\n${home.sections.features.subtitle}\n\n${home.features.map((f) => `- **${f.title}.** ${f.desc}`).join("\n")}`,
	`## ${home.sections.how.title}\n\n${steps.map((s) => `${s.n}. **${s.title}.** ${s.desc}`).join("\n")}`,
	`## Enlaces\n\n- Documentación: ${site.docsUrl}\n- Changelog (novedades): ${site.changelogUrl}\n- Soporte (tickets con el equipo): ${site.supportUrl}\n- Dashboard (panel de control): ${site.dashboardUrl}\n- Asistente de IA: /support/assistant`,
	`## ${home.cta.title}\n\n${home.cta.subtitle}`,
].join("\n\n");

page({
	file: "home.md",
	title: site.name,
	url: "/",
	summary: site.description,
	kind: "site",
	body: homeBody,
});

page({
	file: "support.md",
	title: "Soporte",
	url: site.supportUrl,
	summary: "Abre un ticket y el equipo de SP Agency te responde desde la web.",
	kind: "site",
	body: [
		"Desde **Soporte** abres un ticket con el equipo de SP Agency sin salir de la web. Hace falta iniciar sesión con Discord.",
		"## Cómo funciona un ticket\n\n- Solo puedes tener un ticket abierto a la vez.\n- El equipo te responde en la misma conversación de la web.\n- Al cerrarse, la conversación queda en tu historial de soporte, que puedes consultar cuando quieras. Un ticket cerrado no se puede reabrir.",
		"## El asistente de IA\n\nAntes de abrir un ticket puedes preguntar al asistente de IA en /support/assistant. Si no puede resolver tu duda, te propone abrir un ticket con un resumen ya redactado (marcado como generado con IA).",
		"## Comandos del chat del asistente\n\n- `/usage`: muestra tu consumo de hoy con detalle (unidades usadas y restantes, mensajes, tokens de entrada, de caché y de salida, cuándo se restablece y los últimos 7 días). No gasta nada.\n- `/ticket`: prepara un ticket con lo que habéis hablado en la conversación; se puede añadir una descripción (`/ticket mi problema`). El primer mensaje del ticket lo redacta la IA y así se indica. Revisas el resumen y lo confirmas con un botón. Solo se puede tener un ticket abierto a la vez.\n\nCada usuario tiene un límite diario de uso del asistente que se restablece a medianoche (hora de Madrid); `/usage` muestra cuánto queda. Las conversaciones las puede leer el staff y no se pueden borrar desde el chat: para borrarlas hay que pedírselo al staff con un ticket.",
	].join("\n\n"),
});

page({
	file: "changelog.md",
	title: "Changelog",
	url: site.changelogUrl,
	summary: "Novedades y cambios de cada versión de SP Agency.",
	kind: "site",
	body: "El **Changelog** en /changelog recoge las novedades de cada versión de SP Agency, de la más reciente a la más antigua.",
});

// ── Dashboard: se extrae de los .astro ──────────────────────────────────────

const text = (html) =>
	html
		.replace(/<[^>]+>/g, " ")
		.replace(/\{[^}]*\}/g, " ")
		.replace(/\s+/g, " ")
		.trim();

const attrs = (source) => {
	const found = {};
	for (const m of source.matchAll(/([\w:-]+)=(?:"([^"]*)"|'([^']*)')/g)) found[m[1]] = m[2] ?? m[3];
	return found;
};

function extractDashboard(source) {
	const body = source.replace(/^---[\s\S]*?---/, "");
	const tag = /<(DashboardShell|SettingCard|Toggle|FieldRow|h2|option)\b([^>]*)>|<\/FieldRow>/g;

	let title = "";
	let subtitle = "";
	const lines = [];
	let field = null;

	const flush = () => {
		if (!field) return;
		const options = field.options.length ? ` Opciones: ${field.options.join(" / ")}.` : "";
		lines.push(`- **${field.label}**${field.description ? `: ${field.description}` : "."}${options}`);
		field = null;
	};

	for (const m of body.matchAll(tag)) {
		const [whole, name, raw] = m;
		if (!name) {
			flush();
			continue;
		}
		const a = attrs(raw ?? "");

		if (name === "DashboardShell") {
			title = a.title ?? title;
			subtitle = a.subtitle ?? subtitle;
		} else if (name === "SettingCard") {
			flush();
			lines.push(`\n## ${a.title}${a.description ? `\n\n${a.description}\n` : "\n"}`);
			if (a.name) lines.push("- Se activa o desactiva con el interruptor del bloque.");
		} else if (name === "Toggle") {
			flush();
			lines.push(`- **${a.label}** (interruptor)${a.description ? `: ${a.description}` : ""}`);
		} else if (name === "FieldRow") {
			flush();
			field = { label: a.label, description: a.description ?? "", options: [] };
		} else if (name === "option") {
			const after = body.slice(m.index + whole.length);
			const label = text(after.slice(0, after.indexOf("</option>")));
			if (field && label) field.options.push(label);
		} else if (name === "h2") {
			// Bloques con cabecera propia (p. ej. el Modo Pánico): título + su párrafo.
			flush();
			const after = body.slice(m.index + whole.length);
			const heading = text(after.slice(0, after.indexOf("</h2>")));
			const para = after.slice(after.indexOf("</h2>")).match(/<p\b[^>]*>([\s\S]*?)<\/p>/);
			lines.push(`\n## ${heading}${para ? `\n\n${text(para[1])}\n` : "\n"}`);
		}
	}
	flush();

	return { title, subtitle, body: lines.join("\n").replace(/\n{3,}/g, "\n\n") };
}

const dashboardDir = join(root, "src/pages/dashboard/[guildId]");
for (const name of readdirSync(dashboardDir).filter((f) => f.endsWith(".astro") && f !== "index.astro")) {
	const section = name.replace(".astro", "");
	const { title, subtitle, body } = extractDashboard(readFileSync(join(dashboardDir, name), "utf8"));
	if (!title || !body.trim()) continue;

	page({
		file: `dashboard-${section}.md`,
		title: `Dashboard: ${title}`,
		url: site.dashboardUrl,
		summary: subtitle,
		kind: "dashboard",
		body: `Sección **${title}** del dashboard. Se abre en ${site.dashboardUrl}, eligiendo el servidor y entrando en ${title} del menú lateral (hace falta ser administrador del servidor y que SP Agency esté en él).\n\n${body}`,
	});
}

// ── Resto de páginas públicas: se descubren recorriendo src/pages ───────────
// Cualquier .astro nuevo entra solo, con el texto que tenga escrito en su marcado.
// Se salta lo que no es una página pública de contenido (API, sesión, staff,
// verificación, rutas dinámicas), lo que ya se genera arriba (la misma URL no se
// repite) y lo que lleve `export const knowledge = false;` en su cabecera.

const SKIP = [/^api\//, /^auth\//, /^staff\//, /^verify\//, /^dashboard\//, /^docs\//, /^changelog\/admin/, /^404/, /^black-hole/, /\[/];

// Quita los bloques {…} de JavaScript del marcado (con llaves anidadas), tras
// resolver los {legal.x} simples, que sí son texto.
function stripExpressions(html, values) {
	html = html.replace(/\{legal\.(\w+)\}/g, (m, key) => (typeof values[key] === "string" ? values[key] : ""));
	let out = "";
	let depth = 0;
	for (const ch of html) {
		if (ch === "{") depth++;
		else if (ch === "}") depth = Math.max(0, depth - 1);
		else if (!depth) out += ch;
	}
	return out;
}

function markupToMarkdown(source, values) {
	let body = source
		.replace(/^---[\s\S]*?\n---/, "")
		.replace(/<script\b[\s\S]*?<\/script>/g, "")
		.replace(/<style\b[\s\S]*?<\/style>/g, "")
		.replace(/<!--[\s\S]*?-->/g, "");
	body = stripExpressions(body, values)
		.replace(/<h[12]\b[^>]*>/g, "\n\n## ")
		.replace(/<h3\b[^>]*>/g, "\n\n### ")
		.replace(/<\/h[1-3]>/g, "\n\n")
		.replace(/<li\b[^>]*>/g, "\n- ")
		.replace(/<\/t[dh]>\s*<t[dh]\b[^>]*>/g, " | ")
		.replace(/<tr\b[^>]*>/g, "\n- ")
		.replace(/<\/(p|div|section|ul|ol|table|thead|tbody|article|header|button)>|<br\s*\/?>/g, "\n")
		.replace(/<[^>]+>/g, " ")
		.replace(/&nbsp;/g, " ")
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'");
	return body
		.split("\n")
		.map((line) => line.replace(/[ \t]+/g, " ").trim())
		.filter((line) => !/^#{2,3}$/.test(line))
		.join("\n")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}

const { legal } = await load("src/lib/legal.ts");
const pagesDir = join(root, "src/pages");
const taken = new Set(sitemap.map((p) => p.url));

for (const rel of readdirSync(pagesDir, { recursive: true })
	.map((p) => String(p).replaceAll("\\", "/"))
	.filter((p) => p.endsWith(".astro"))
	.sort()) {
	if (SKIP.some((re) => re.test(rel))) continue;

	const url = "/" + rel.replace(/\.astro$/, "").replace(/(^|\/)index$/, "");
	if (url === "/" || taken.has(url)) continue;

	const source = readFileSync(join(pagesDir, rel), "utf8");
	if (/export\s+const\s+knowledge\s*=\s*false/.test(source)) continue;

	const head = source.match(/<(?:Layout|LegalPage)\b([^>]*)>/);
	const props = head ? attrs(head[1]) : {};
	const title = (props.title ?? rel.replace(/\.astro$/, "")).replace(/\s+—\s+SP Agency$/, "");
	const body = markupToMarkdown(source, legal);
	if (!body && !props.description) continue;

	page({
		file: `page-${rel.replace(/\.astro$/, "").replace(/\//g, "-")}.md`,
		title,
		url,
		summary: props.description ?? "",
		kind: "site",
		body: body || props.description,
	});
	taken.add(url);
}

// ── Mapa del sitio (va en el prompt de sistema: corto y siempre igual) ──────

files.set(
	"_sitemap.md",
	sitemap.map((p) => `- ${p.title} (${p.url})`).join("\n") + "\n",
);

// ── Escritura ───────────────────────────────────────────────────────────────

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const [file, content] of files) writeFileSync(join(out, file), content);

const chars = [...files.values()].reduce((sum, c) => sum + c.length, 0);
console.log(`knowledge: ${files.size} archivos, ${docGroups.length} grupos de docs, ~${Math.round(chars / 3.5)} tokens → knowledge/`);
