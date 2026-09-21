// Datos que comparten los Términos del servicio y la Política de privacidad
// (src/pages/terminos.astro y privacidad.astro). Si algo cambia (fecha, titular,
// contacto), se cambia aquí y se actualizan los dos textos.
export const legal = {
	product: "SP Agency",
	// Quién presta el servicio.
	entity: "The Indie Brand",
	// Fecha de la última revisión de los textos. Súbela cada vez que cambies algo de fondo.
	updated: "21 de septiembre de 2026",
	updatedIso: "2026-09-21",
	// Datos del titular. Son opcionales: si los rellenas aparecen en los textos; si no,
	// no sale nada. Conviene completarlos (la normativa española de servicios de la
	// sociedad de la información pide identificar al prestador: NIF/CIF, domicilio y
	// un correo de contacto).
	holder: {} as { taxId?: string; address?: string; email?: string },
	// Servicio de blacklist global con el que trabaja el bot.
	ubfbUrl: "https://ubfb.theindiebrand.es",
	ubfbAppealsUrl: "https://ubfb.theindiebrand.es/panel",
	// Autoridad de protección de datos ante la que se puede reclamar.
	dpaName: "la Agencia Española de Protección de Datos (AEPD)",
	dpaUrl: "https://www.aepd.es",
};
