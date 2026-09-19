// Enlaces y navegación globales del sitio. Los que aún no tienen destino real
// apuntan a "#"; cuando existan (invitación del bot, docs, soporte...) basta
// con cambiarlos aquí y se actualizan en el navbar, el hero, la CTA y el footer.
export const site = {
	name: "SP Agency",
	title: "SP Agency — Seguridad anti-raid para Discord",
	description:
		"SP Agency detecta y bloquea raids, spam y cuentas falsas en tu servidor de Discord en tiempo real.",
	inviteUrl: "#",
	docsUrl: "#",
	supportUrl: "#",
	changelogUrl: "#",
	dashboardUrl: "/dashboard",
};

export const navLinks = [
	{ label: "Documentación", href: site.docsUrl },
	{ label: "Changelog", href: site.changelogUrl },
	{ label: "Soporte", href: site.supportUrl },
	{ label: "Dashboard", href: site.dashboardUrl },
];

export const footerColumns = [
	{
		title: "Producto",
		links: [
			{ label: "Funciones", href: "#" },
			{ label: "Comandos", href: "#" },
			{ label: "Changelog", href: site.changelogUrl },
		],
	},
	{
		title: "Recursos",
		links: [
			{ label: "Documentación", href: site.docsUrl },
			{ label: "Soporte", href: site.supportUrl },
			{ label: "Estado del sistema", href: "#" },
		],
	},
	{
		title: "Comunidad",
		links: [
			{ label: "Discord", href: "#" },
			{ label: "GitHub", href: "#" },
			{ label: "Términos", href: "#" },
		],
	},
];
