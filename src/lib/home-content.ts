// home page text shown in more than one place (the animated scene, the
// static fallback and the screen-reader version). single source: if a text
// changes, it changes here. steps and testimonials live in steps.ts and testimonials.ts.

export const labels = {
	invite: "Añadir a Discord",
	inviteFree: "Añadir a Discord — gratis",
	docs: "Ver documentación",
};

export const hero = {
	title: "Tu servidor, blindado contra raids en tiempo real.",
	subtitle:
		"SP Agency detecta oleadas de bots, cuentas falsas y ataques coordinados en segundos, y responde automáticamente antes de que tu comunidad lo note.",
};

export const sections = {
	features: {
		eyebrow: "Funciones",
		title: "Todo lo que necesitas para dormir tranquilo",
		subtitle: "Un sistema de defensa completo, configurable en minutos y sin tocar código.",
	},
	how: {
		eyebrow: "Cómo funciona",
		title: "Configurado en tres pasos",
	},
	testimonials: {
		eyebrow: "Testimonios",
		title: "Lo que dice la comunidad",
	},
};

export const cta = {
	title: "Empieza a proteger tu servidor hoy",
	subtitle: "Configuración en menos de 5 minutos. Sin tarjeta de crédito.",
};

export interface Feature {
	icon: string;
	title: string;
	desc: string;
}

export const features: Feature[] = [
	{
		icon: "bi-broadcast-pin",
		title: "Detección de raids en tiempo real",
		desc: "Frena ráfagas de canales, roles y bans masivos y banea a quien las causa.",
	},
	{
		icon: "bi-patch-check",
		title: "Verificación de cuentas",
		desc: "Puntúa cuentas nuevas o sospechosas al unirse y exige verificación con captcha.",
	},
	{
		icon: "bi-funnel",
		title: "Automoderación",
		desc: "Anti-flood, mayúsculas, emojis y ghost-pings, con sanciones que escalan.",
	},
	{
		icon: "bi-file-earmark-text",
		title: "Registros de seguridad",
		desc: "Historial detallado de cada acción para auditar lo que pasó y cuándo.",
	},
	{
		icon: "bi-person-fill-x",
		title: "Cuentas maliciosas",
		desc: "Comprueba cada cuenta al unirse contra la lista global de usuarios maliciosos.",
	},
	{
		icon: "bi-speedometer2",
		title: "Panel de control web",
		desc: "Configura umbrales, whitelist y alertas sin tocar comandos.",
	},
];
