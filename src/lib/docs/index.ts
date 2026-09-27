import { gettingStarted } from "./getting-started.ts";
import { protection } from "./protection.ts";
import { moderation } from "./moderation.ts";
import { recovery, help } from "./recovery.ts";
import { web } from "./web.ts";
import type { DocGroup, DocPage } from "./types.ts";

export type { DocBlock, DocGroup, DocPage } from "./types.ts";

// order of the sidebar and of the previous/next buttons.
export const docGroups: DocGroup[] = [
	{ title: "Empezar", pages: gettingStarted },
	{ title: "Protección", pages: protection },
	{ title: "Moderación", pages: moderation },
	{ title: "Recuperación y registros", pages: recovery },
	{ title: "La web", pages: web },
	{ title: "Ayuda", pages: help },
];

export const docPages: DocPage[] = docGroups.flatMap((group) => group.pages);

export const getDocPage = (slug: string) => docPages.find((page) => page.slug === slug);

export function getNeighbors(slug: string) {
	const i = docPages.findIndex((page) => page.slug === slug);
	return { prev: docPages[i - 1], next: docPages[i + 1] };
}

// heading ids are stable (no accents or punctuation) so other pages can link
// to them: "Quien añade un bot raider" → "quien-anade-un-bot-raider".
export function slugify(text: string) {
	return text
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

export function getHeadings(page: DocPage) {
	return page.blocks.flatMap((block) => (block.type === "h" ? [{ id: slugify(block.text), text: block.text }] : []));
}

// inline text for blocks: `code`, **bold** and [links](/docs/...). escaped
// before formatting, so the content never injects html.
export function renderInline(text: string) {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(
			/`([^`]+)`/g,
			'<code class="border-border-soft bg-bg-soft text-text rounded border px-1.5 py-0.5 font-mono text-[0.85em]">$1</code>',
		)
		.replace(/\*\*([^*]+)\*\*/g, '<strong class="text-text font-semibold">$1</strong>')
		.replace(
			/\[([^\]]+)\]\(([^)\s]+)\)/g,
			'<a href="$2" class="text-brand hover:text-brand-hover underline decoration-[#0079bb]/40 underline-offset-2 transition-colors">$1</a>',
		);
}
