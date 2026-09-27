import { Marked, type Tokens } from "marked";
import sanitizeHtml from "sanitize-html";

// common changelog sections → accent class (see .changelog-prose in
// global.css). recognized by the `###` text, lowercased with accents
// stripped, so just writing "### Agregado" colors it automatically.
const SECTION_KINDS: Record<string, "added" | "changed" | "fixed" | "removed"> = {
	agregado: "added",
	agregados: "added",
	anadido: "added",
	anadidos: "added",
	nuevo: "added",
	nuevos: "added",
	modificado: "changed",
	modificados: "changed",
	cambiado: "changed",
	cambios: "changed",
	mejorado: "changed",
	mejoras: "changed",
	arreglado: "fixed",
	arreglados: "fixed",
	corregido: "fixed",
	corregidos: "fixed",
	eliminado: "removed",
	eliminados: "removed",
	quitado: "removed",
	retirado: "removed",
};

function normalize(text: string): string {
	return text
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.replace(/[^a-z0-9 ]/gi, "")
		.trim()
		.toLowerCase();
}

const isSubtext = (text: string) => text.startsWith("-# ");
const stripSubtext = (text: string) => text.replace(/^-# /gm, "");

// separate instance, no renderer of its own, only for the inline markdown of
// subtexts (so the renderer below doesn't depend on itself).
const inline = new Marked({ gfm: true });

const marked = new Marked({
	gfm: true,
	renderer: {
		heading({ tokens, depth, text }: Tokens.Heading) {
			const inner = this.parser.parseInline(tokens);
			const kind = depth === 3 ? SECTION_KINDS[normalize(text)] : undefined;
			return `<h${depth}${kind ? ` class="cl-${kind}"` : ""}>${inner}</h${depth}>\n`;
		},
		// `-# text` is discord's subtext: a small, muted paragraph.
		paragraph({ text, tokens }: Tokens.Paragraph) {
			if (!isSubtext(text)) return `<p>${this.parser.parseInline(tokens)}</p>\n`;
			return `<p class="cl-sub">${inline.parseInline(stripSubtext(text))}</p>\n`;
		},
	},
});

// the markdown can carry raw html (including <script>): even though only the
// owner writes it, it's always filtered before display. only the usual text
// tags pass through; no images, iframes, styles or event handlers, and only
// http(s) and mailto links.
function sanitize(html: string): string {
	return sanitizeHtml(html, {
		allowedTags: [
			"h2",
			"h3",
			"h4",
			"h5",
			"h6",
			"p",
			"ul",
			"ol",
			"li",
			"strong",
			"em",
			"del",
			"code",
			"pre",
			"blockquote",
			"a",
			"hr",
			"br",
			"table",
			"thead",
			"tbody",
			"tr",
			"th",
			"td",
		],
		allowedAttributes: {
			a: ["href", "title", "rel"],
			h3: ["class"],
			p: ["class"],
			ol: ["start"],
			th: ["align"],
			td: ["align"],
		},
		allowedClasses: { h3: ["cl-added", "cl-changed", "cl-fixed", "cl-removed"], p: ["cl-sub"] },
		allowedSchemes: ["http", "https", "mailto"],
		allowProtocolRelative: false,
		transformTags: {
			// a second `# ` inside the body doesn't compete with the entry's title.
			h1: "h2",
			a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }),
		},
	});
}

// "DisChord Code Studio v1.9.1" → version "v1.9.1" + name "DisChord Code Studio".
// the version is shown large and the name stays as secondary text. if the
// title carries no version (something like v1.9, 2.0.1-beta), version stays empty.
const VERSION_RE = /\bv?\d+\.\d+(?:\.\d+)*(?:[-+][0-9A-Za-z.]+)?/;

function splitTitle(title: string): { name: string; version: string } {
	const match = VERSION_RE.exec(title);
	if (!match) return { name: title, version: "" };

	const raw = match[0];
	const version = /^v/i.test(raw) ? `v${raw.slice(1)}` : `v${raw}`;
	const name = (title.slice(0, match.index) + title.slice(match.index + raw.length))
		.replace(/\s+/g, " ")
		.replace(/^[\s\-–—:·|]+|[\s\-–—:·|]+$/g, "");

	return { name, version };
}

export interface RenderedMarkdown {
	title: string;
	name: string;
	version: string;
	// inline html (already sanitized) of the `-# **Actualízate**` under the title; "" if there is none.
	subtitle: string;
	html: string;
}

// the markdown's first `# ` is the title (and the version: "SP Agency v1.9.1");
// separated from the body so the page can style it on its own. if there's a
// `-# subtitle` right below it, that's also split out and shown next to the title.
export function renderMarkdown(source: string): RenderedMarkdown {
	const tokens = marked.lexer(source);
	const h1 = tokens.findIndex((t) => t.type === "heading" && t.depth === 1);

	let title = "Sin título";
	let subtitle = "";
	let body = [...tokens];

	if (h1 !== -1) {
		title = (tokens[h1] as Tokens.Heading).text.replace(/[`*_~]/g, "").trim() || title;
		body = [...tokens.slice(0, h1), ...tokens.slice(h1 + 1)];

		const next = body.findIndex((t, i) => i >= h1 && t.type !== "space");
		const candidate = next === -1 ? undefined : body[next];
		if (candidate?.type === "paragraph" && isSubtext(candidate.text)) {
			subtitle = sanitize(inline.parseInline(stripSubtext(candidate.text)) as string);
			body.splice(next, 1);
		}
	}

	return { title, ...splitTitle(title), subtitle, html: sanitize(marked.parser(body)) };
}
