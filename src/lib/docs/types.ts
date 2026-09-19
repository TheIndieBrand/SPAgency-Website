// Modelo de la documentación. Cada página es una lista de bloques; el texto admite
// `código` y **negrita** en línea (ver renderInline en components/docs/DocBlocks.astro).
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
	// Clase de bootstrap-icons (sin el prefijo `bi`).
	icon: string;
	blocks: DocBlock[];
}

export interface DocGroup {
	title: string;
	pages: DocPage[];
}
