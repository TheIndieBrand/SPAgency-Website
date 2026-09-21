// Cualquier enlace a otra web se abre en una pestaña nueva, también los que se pintan
// después de cargar (chat, tarjetas del dashboard). Se marca al pulsar, justo antes de que
// el navegador navegue, así que no hace falta tocar cada plantilla. Los enlaces con
// `data-same-tab` se quedan como están.
document.addEventListener(
	"click",
	(event) => {
		const link = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
		if (!link || link.target || link.hasAttribute("data-same-tab") || link.hasAttribute("download")) return;
		if (!/^https?:$/.test(link.protocol) || link.origin === window.location.origin) return;
		link.target = "_blank";
		link.rel = "noopener noreferrer";
	},
	true,
);
