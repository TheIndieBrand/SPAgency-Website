// Los tres pasos de "Cómo funciona". Se muestran animados dentro de la escena
// de entrada (AsymptoteScene: cada paso es un nodo del camino) y como sección
// estática de respaldo (HowItWorks) cuando no hay animación. `short` es la
// versión de una palabra que usa el recap de la CTA final (SceneCta).
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
		title: "Protegido 24/7",
		short: "Protegido",
		desc: "Detección y respuesta automática desde el primer minuto.",
	},
];
