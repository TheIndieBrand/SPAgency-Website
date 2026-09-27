// data shared by the terms of service and the privacy policy
// (src/pages/terminos.astro and privacidad.astro). if anything changes (date,
// owner, contact), it's changed here and both texts update.
export const legal = {
	product: "SP Agency",
	// who provides the service.
	entity: "The Indie Brand",
	// date the texts were last revised. bump it whenever something substantive changes.
	updated: "21 de septiembre de 2026",
	updatedIso: "2026-09-21",
	// the owner's details. optional: filled in, they appear in the texts; left
	// empty, nothing shows. worth completing (spanish information-society
	// services law asks the provider be identified: tax id, address and a
	// contact email).
	holder: {} as { taxId?: string; address?: string; email?: string },
	// the global blacklist service the bot works with.
	ubfbUrl: "https://ubfb.theindiebrand.es",
	ubfbAppealsUrl: "https://ubfb.theindiebrand.es/panel",
	// the data protection authority a complaint can be filed with.
	dpaName: "la Agencia Española de Protección de Datos (AEPD)",
	dpaUrl: "https://www.aepd.es",
};
