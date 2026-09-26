// list of testimonials: add or remove objects here to update the section.
// `avatar` points to a file inside public/avatars/ — just drop the image
// there under that name and it shows up.
//
// `decoration` is optional: if the user has a discord "avatar decoration",
// point to the ring's transparent png (without compositing it onto the
// avatar by hand) and it's layered on its own, larger, uncropped. with a
// decoration, the base avatar carries no blue border so they don't clash.
//
// shown in the intro scene's final carousel (AsymptoteScene) and in the
// static fallback section (Testimonials) when there's no animation.

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
	{
		username: "vamp1re",
		userId: "1544516984870404197",
		role: "Cybersecurity Ingeneer",
		avatar: "/avatars/vampire.png",
		comment: "meti este bot a mi servidor y me senti tan relajado.. como si estuviera en un spa"
	},
	{
		username: "SP Agency",
		userId: "0",
		role: "SP Agency @ Official Bot",
		avatar: "/avatars/spagency.png",
		comment: "ola"
	}
];
