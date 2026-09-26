// turns the site routes the assistant cites into buttons, whether they come
// as a markdown link ([Anti-Raid](/docs/anti-raid)) or written bare in the
// text (/docs/anti-raid#lista-blanca), with or without surrounding `code`.
// only the ones that exist are converted (the list comes from the sitemap):
// a route the model made up stays as plain text, instead of a button leading to a 404.

export type Routes = Record<string, string>;

// sections whose routes don't come from the sitemap (dynamic pages hang off these).
const BaseSections = ["docs", "support", "changelog", "dashboard"];

// a bare route: starts with a real site section and isn't attached to
// anything else (so it isn't confused with a command like /backup, or part
// of a url). the sections come from the sitemap's routes, so a new page
// (/terminos, /privacidad…) is recognized on its own.
function bareRoute(routes: Routes): RegExp {
	const sections = new Set(BaseSections);
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
	return "bi-file-earmark-text"; // any new page
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
	// 1. markdown links to site routes.
	root.querySelectorAll<HTMLAnchorElement>('a[href^="/"]:not(.route-chip)').forEach((a) => {
		const href = a.getAttribute("href") ?? "";
		if (href.startsWith("//") || !isKnown(href.split("#")[0], routes)) return;
		const text = a.textContent?.trim() ?? "";
		a.replaceWith(chip(href, !text || text.startsWith("/") ? labelFor(href, routes) : text));
	});

	const bare = bareRoute(routes);

	// 2. bare routes in the text (outside links, buttons and code blocks).
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

		// a bare `/docs/anti-raid` inside <code>: the whole <code> is replaced.
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
