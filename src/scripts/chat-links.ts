// Convierte en botones las rutas de la web que cita el asistente, tanto las que
// vienen como enlace de Markdown ([Anti-Raid](/docs/anti-raid)) como las que
// escribe sueltas en el texto (/docs/anti-raid#lista-blanca), con o sin
// `código` alrededor. Solo se convierten las que existen (la lista sale del mapa
// del sitio): una ruta inventada por el modelo se queda como texto normal, en vez
// de un botón que lleva a un 404.

export type Routes = Record<string, string>;

// Secciones cuyas rutas no salen del mapa (de ellas cuelgan páginas dinámicas).
const BASE_SECTIONS = ["docs", "support", "changelog", "dashboard"];

// Ruta suelta: empieza por una sección real de la web y no va pegada a otra cosa
// (así no se confunde con un comando como /backup ni con parte de una URL). Las
// secciones salen de las rutas del mapa del sitio, así que una página nueva
// (/terminos, /privacidad…) se reconoce sola.
function bareRoute(routes: Routes): RegExp {
	const sections = new Set(BASE_SECTIONS);
	for (const path of Object.keys(routes)) {
		const first = path.split("/")[1];
		if (first) sections.add(first);
	}
	const names = [...sections].map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
	return new RegExp(`(?<![\\w/.:#-])\\/(?:${names})(?:\\/[\\w-]+)*(?:#[\\w-]+)?`, "g");
}

const isKnown = (path: string, routes: Routes) =>
	path in routes || path.startsWith("/changelog/") || path.startsWith("/support/tickets/");

function iconFor(path: string): string {
	if (path.startsWith("/docs")) return "bi-book";
	if (path.startsWith("/dashboard")) return "bi-speedometer2";
	if (path.startsWith("/support/tickets")) return "bi-ticket-perforated";
	if (path.startsWith("/support")) return "bi-life-preserver";
	if (path.startsWith("/changelog")) return "bi-clock-history";
	if (path.startsWith("/privacidad")) return "bi-shield-lock";
	if (path.startsWith("/testimonios")) return "bi-chat-quote";
	return "bi-file-earmark-text"; // cualquier página nueva
}

// "/docs/anti-raid#lista-blanca" → "Anti-Raid › lista blanca"
function labelFor(href: string, routes: Routes): string {
	const [path, hash] = href.split("#");
	const title = routes[path] ?? (path.startsWith("/changelog/") ? "Changelog" : path.startsWith("/support/tickets/") ? "Tu ticket" : path);
	return hash ? `${title} › ${decodeURIComponent(hash).replace(/-/g, " ")}` : title;
}

function icon(name: string): HTMLElement {
	const el = document.createElement("i");
	el.className = `bi ${name}`;
	el.setAttribute("aria-hidden", "true");
	return el;
}

function chip(href: string, label: string): HTMLAnchorElement {
	const a = document.createElement("a");
	a.className = "route-chip";
	a.href = href;
	a.target = "_blank";
	a.rel = "noopener";
	const text = document.createElement("span");
	text.textContent = label;
	a.append(icon(iconFor(href)), text, icon("bi-box-arrow-up-right"));
	return a;
}

export function decorateRoutes(root: Element, routes: Routes): void {
	// 1. Enlaces de Markdown a rutas del sitio.
	root.querySelectorAll<HTMLAnchorElement>('a[href^="/"]:not(.route-chip)').forEach((a) => {
		const href = a.getAttribute("href") ?? "";
		if (href.startsWith("//") || !isKnown(href.split("#")[0], routes)) return;
		const text = a.textContent?.trim() ?? "";
		a.replaceWith(chip(href, !text || text.startsWith("/") ? labelFor(href, routes) : text));
	});

	const bare = bareRoute(routes);

	// 2. Rutas sueltas en el texto (fuera de enlaces, botones y bloques de código).
	const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
		acceptNode: (node) =>
			node.parentElement?.closest("a, pre, button") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
	});
	const nodes: Text[] = [];
	for (let node = walker.nextNode(); node; node = walker.nextNode()) nodes.push(node as Text);

	for (const node of nodes) {
		const text = node.data;
		const matches = [...text.matchAll(bare)].filter((m) => isKnown(m[0].split("#")[0], routes));
		if (!matches.length) continue;

		// `/docs/anti-raid` a secas dentro de <code>: se sustituye el <code> entero.
		const parent = node.parentElement;
		if (parent?.tagName === "CODE" && matches.length === 1 && matches[0][0] === text.trim() && parent.childNodes.length === 1) {
			parent.replaceWith(chip(matches[0][0], labelFor(matches[0][0], routes)));
			continue;
		}

		const fragment = document.createDocumentFragment();
		let last = 0;
		for (const m of matches) {
			fragment.append(text.slice(last, m.index));
			fragment.append(chip(m[0], labelFor(m[0], routes)));
			last = m.index + m[0].length;
		}
		fragment.append(text.slice(last));
		node.replaceWith(fragment);
	}
}
