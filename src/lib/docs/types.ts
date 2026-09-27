// docs data model. each page is a list of blocks; text supports inline
// `code` and **bold** (see renderInline in components/docs/DocBlocks.astro).
export type DocBlock =
	| { type: "p"; text: string }
	| { type: "h"; text: string }
	| { type: "list"; items: string[]; ordered?: boolean }
	| { type: "callout"; tone: "info" | "tip" | "warning"; title?: string; text: string }
	| { type: "table"; head: string[]; rows: string[][] };

export interface DocPage {
	slug: string;
	title: string;
	summary: string;
	// a bootstrap-icons class (without the `bi` prefix).
	icon: string;
	blocks: DocBlock[];
}

export interface DocGroup {
	title: string;
	pages: DocPage[];
}
