// Textos del home que se muestran en más de un sitio (la escena animada, el
// respaldo estático y la versión para lectores de pantalla). Fuente única: si
// cambia un texto, se cambia aquí. Los pasos y los testimonios viven en
// steps.ts y testimonials.ts.

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
		desc: "Analiza patrones de entrada y bloquea oleadas de cuentas antes de que actúen.",
	},
	{
		icon: "bi-patch-check",
		title: "Verificación de cuentas",
		desc: "Filtra cuentas nuevas, sin avatar o sospechosas con reglas configurables.",
	},
	{
		icon: "bi-funnel",
		title: "Anti-spam inteligente",
		desc: "Detecta mensajes masivos, menciones y enlaces maliciosos al instante.",
	},
	{
		icon: "bi-file-earmark-text",
		title: "Registros de seguridad",
		desc: "Historial detallado de cada acción para auditar lo que pasó y cuándo.",
	},
	{
		icon: "bi-cpu",
		title: "Auto-moderación con IA",
		desc: "Modelos entrenados para distinguir tráfico legítimo de ataques coordinados.",
	},
	{
		icon: "bi-speedometer2",
		title: "Panel de control web",
		desc: "Configura umbrales, whitelist y alertas sin tocar comandos.",
	},
];
