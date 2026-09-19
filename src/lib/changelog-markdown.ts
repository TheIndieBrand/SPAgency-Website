import { Marked, type Tokens } from "marked";
import sanitizeHtml from "sanitize-html";

// Secciones habituales de un changelog → clase de acento (ver .changelog-prose
// en global.css). Se reconocen por el texto del `###`, sin acentos y en
// minúsculas, así que basta con escribir "### Agregado" y se colorea solo.
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

// Instancia aparte, sin renderer propio, solo para el markdown en línea de los
// subtextos (así el renderer de abajo no depende de sí mismo).
const inline = new Marked({ gfm: true });

const marked = new Marked({
	gfm: true,
	renderer: {
		heading({ tokens, depth, text }: Tokens.Heading) {
			const inner = this.parser.parseInline(tokens);
			const kind = depth === 3 ? SECTION_KINDS[normalize(text)] : undefined;
			return `<h${depth}${kind ? ` class="cl-${kind}"` : ""}>${inner}</h${depth}>\n`;
		},
		// `-# texto` es el subtexto de Discord: un párrafo pequeño y apagado.
		paragraph({ text, tokens }: Tokens.Paragraph) {
			if (!isSubtext(text)) return `<p>${this.parser.parseInline(tokens)}</p>\n`;
			return `<p class="cl-sub">${inline.parseInline(stripSubtext(text))}</p>\n`;
		},
	},
});

// El markdown puede traer HTML crudo (incluido <script>): aunque solo lo
// escriba el dueño, siempre se filtra antes de mostrarlo. Solo pasan las
// etiquetas de texto habituales; nada de imágenes, iframes, estilos ni
// manejadores de eventos, y solo enlaces http(s) y mailto.
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
			// Un segundo `# ` dentro del cuerpo no compite con el título de la entrada.
			h1: "h2",
			a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }),
		},
	});
}

// "DisChord Code Studio v1.9.1" → versión "v1.9.1" + nombre "DisChord Code Studio".
// La versión se pinta grande y el nombre queda como texto secundario. Si el
// título no lleva versión (algo tipo v1.9, 2.0.1-beta), version queda vacía.
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
	// HTML en línea (ya saneado) del `-# **Actualízate**` bajo el título; "" si no hay.
	subtitle: string;
	html: string;
}

// El primer `# ` del markdown es el título (y la versión: "SP Agency v1.9.1");
// se separa del cuerpo para que la página lo pinte con su propio estilo. Si
// justo debajo hay un `-# subtítulo`, también se separa y va pegado al título.
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
