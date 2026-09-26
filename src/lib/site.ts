// the site's global links and navigation. the ones with no real destination
// yet point to "#"; once they exist (bot invite, docs, support...) they only
// need changing here, and the navbar, hero, cta and footer all update.
export const site = {
	name: "SP Agency",
	title: "SP Agency — Seguridad anti-raid para Discord",
	description:
		"SP Agency detecta y bloquea raids, spam y cuentas falsas en tu servidor de Discord en tiempo real.",
	// redirects to the discord invite and, once done, to /gracias (see pages/invite.ts).
	inviteUrl: "/invite",
	discordUrl: "https://discord.gg/mG5CaDvKsk",
	githubUrl: "https://github.com/devEthan6737/SPAgency",
	docsUrl: "/docs",
	supportUrl: "/support",
	changelogUrl: "/changelog",
	dashboardUrl: "/dashboard",
	assistantUrl: "/support/assistant",
	termsUrl: "/terminos",
	privacyUrl: "/privacidad",
};

// `icon` (a bootstrap-icons class) is optional: the navbar renders it in front.
export interface NavLink {
	label: string;
	href: string;
	icon?: string;
}

export const navLinks: NavLink[] = [
	{ label: "Documentación", href: site.docsUrl },
	{ label: "Changelog", href: site.changelogUrl },
	{ label: "Soporte", href: site.supportUrl },
	{ label: "Asistente", href: site.assistantUrl, icon: "bi-stars" },
	{ label: "Dashboard", href: site.dashboardUrl },
];

export const footerColumns = [
	{
		title: "Producto",
		links: [
			{ label: "Dashboard", href: site.dashboardUrl },
			{ label: "Invitar bot", href: site.inviteUrl },
			{ label: "Comandos", href: "/docs/comandos" },
			{ label: "Changelog", href: site.changelogUrl },
		],
	},
	{
		title: "Recursos",
		links: [
			{ label: "Documentación", href: site.docsUrl },
			{ label: "Soporte", href: site.supportUrl },
		],
	},
	{
		title: "Comunidad",
		links: [
			{ label: "Testimonios", href: "/testimonios" },
			{ label: "Discord", href: site.discordUrl },
			{ label: "GitHub", href: site.githubUrl },
			{ label: "Términos", href: site.termsUrl },
			{ label: "Privacidad", href: site.privacyUrl },
		],
	},
];
