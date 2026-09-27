// the three "how it works" steps. shown animated inside the intro scene
// (AsymptoteScene: each step is a node on the path) and as a static fallback
// section (HowItWorks) when there's no animation. `short` is the one-word
// version the final cta's recap uses (SceneCta).
export interface Step {
	n: string;
	title: string;
	short: string;
	desc: string;
}

export const steps: Step[] = [
	{ n: "1", title: "Invita a SP Agency", short: "Invita", desc: "Un clic, sin configuración compleja de por medio." },
	{
		n: "2",
		title: "Define tus reglas",
		short: "Configura",
		desc: "Umbrales de raid, verificación y listas blancas a tu medida.",
	},
	{
		n: "3",
		title: "Protegido",
		short: "Protegido",
		desc: "Detección y respuesta automática desde el primer minuto.",
	},
];
