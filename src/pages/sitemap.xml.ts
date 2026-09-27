import type { APIRoute } from "astro";
import { docPages } from "../lib/docs";
import { changelogRepository } from "../lib/ChangelogRepository";
import { site } from "../lib/site";

export const prerender = false;

// Built the same way build-knowledge.mjs builds the assistant's site map: nothing
// to maintain by hand. Docs come from docPages; changelog entries, live from
// SQLite (they're published without a rebuild). Private/app routes (dashboard,
// staff, tickets…) aren't public content and stay out — see public/robots.txt.
const STATIC_PATHS = ["/", "/docs", "/changelog", "/testimonios", "/donaciones", "/terminos", "/privacidad"];

const url = (path: string) => new URL(path, site.url).toString();

export const GET: APIRoute = () => {
	const entries: { loc: string; lastmod?: string }[] = [
		...STATIC_PATHS.map((path) => ({ loc: url(path) })),
		...docPages.map((page) => ({ loc: url(`/docs/${page.slug}`) })),
		...changelogRepository.listChangelogs().map((entry) => ({
			loc: url(`/changelog/${entry.slug}`),
			lastmod: entry.publishedAt.slice(0, 10),
		})),
	];

	const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.map((e) => `\t<url>\n\t\t<loc>${e.loc}</loc>${e.lastmod ? `\n\t\t<lastmod>${e.lastmod}</lastmod>` : ""}\n\t</url>`).join("\n")}
</urlset>
`;

	return new Response(body, {
		headers: { "Content-Type": "application/xml; charset=utf-8" },
	});
};
