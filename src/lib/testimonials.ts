// Lista de testimonios: agregá o quitá objetos acá para actualizar la sección.
// `avatar` apunta a un archivo dentro de public/avatars/ — solo hace falta
// colocar la imagen ahí con ese nombre para que se muestre.
//
// `decoration` es opcional: si el usuario tiene un "avatar decoration" de
// Discord, apuntá al PNG transparente del aro (sin componerlo con el avatar
// a mano) y se superpone en su propia capa, más grande, sin recortar. Con
// decoration, el avatar base no lleva el borde azul para que no choquen.
//
// Se muestran en el carrusel final de la escena de entrada (AsymptoteScene) y
// en la sección estática de respaldo (Testimonials) cuando no hay animación.

export interface Testimonial {
	username: string;
	userId: string;
	role: string;
	avatar: string;
	decoration?: string;
	comment: string;
}

export const testimonials: Testimonial[] = [
	{
		username: "ether",
		userId: "760769497358794783",
		role: "Founder @ SPA",
		avatar: "/avatars/ether.png",
		comment: "spa en seyfert es god",
	},
	{
		username: "Rensga",
		userId: "708479724980142162",
		role: "CEO @ The Indie Brand",
		avatar: "/avatars/rensga.png",
		decoration: "/avatars/rensga-decoration.png",
		comment: "SPA va a ser potencia mundial ahora que no está en discord.jzzzz",
	},
	{
		username: "Zaguspro",
		userId: "642824574773231616",
		role: "Admin @ Kigo",
		avatar: "/avatars/zaguspro.png",
		comment: "Este es un bot con muchas nuevas funciones que ayuda a protegerte a ti y a tus usuarios",
	},
	{
		username: "🍁Eastๅ͟𝓦𝖗𝖎𝖙𝖊𝖗ᴿᶻ",
		userId: "843458878871044106",
		role: "Owner @ RZ",
		avatar: "/avatars/east.png",
		decoration: "/avatars/east-decoration.png",
		comment: "Único para la comunidad.",
	},
	{
		username: "_zPro",
		userId: "655792452996825128",
		role: "CEO @ The Indie Brand",
		avatar: "/avatars/zpro.png",
		comment: "Más rápido y renovado que nunca",
	},
	{
		username: "JustEvil",
		userId: "391283181665517568",
		role: "Owner @ Ganyu Studios",
		avatar: "/avatars/justevil.png",
		decoration: "/avatars/justevil-decoration.png",
		comment: "Que chingue su madre el que no use seyfert",
	},
	{
		username: "VirtualOx",
		userId: "429815351774281748",
		role: "CEO @ The Indie Brand",
		avatar: "/avatars/virtualox.png",
		decoration: "/avatars/virtualox-decoration.png",
		comment:
			"SP Agency no es solo un bot, es un kit completo de protección dentro de su servidor donde ayudara a evitar futuras afectaciones y dolores de cabeza.",
	},
	{
		username: "Doctor",
		userId: "688693850180812856",
		role: "Admin @ Korex Hosting",
		avatar: "/avatars/doctor.png",
		comment: "SPA me cambió la vida, ahora soy millonario",
	},
	{
		username: "Aitor",
		userId: "306787329975123969",
		role: "Founder @ Navigo Bot",
		avatar: "/avatars/aitor.png",
		comment:
			"Es un bot con mucha historia y experiencia detrás. El saber hacer y gestionar, SP lo lleva dentro. Lo recomiendo.",
	},
];
