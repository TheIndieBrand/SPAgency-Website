// Enlaces del navbar a secciones que viven DENTRO de la escena.
import { LINE_CENTER_AT, SC } from "./timing";

export function bindNavAnchors(tl: gsap.core.Timeline) {
	// Enlaces del navbar a secciones que ahora viven DENTRO de la escena (no
	// hay un ancla en el DOM a la que saltar): llevan al punto del scroll donde
	// esa parte de la animación está en pantalla.
	const sceneAnchors: Record<string, number> = {
		"#features": SC + 5.5, // las seis tarjetas de "Funciones"
		"#how": LINE_CENTER_AT + 29.4, // el primer paso, subiendo hacia la punta
	};
	document.querySelectorAll<HTMLAnchorElement>('a[href="#features"], a[href="#how"]').forEach((link) => {
		link.addEventListener("click", (event) => {
			const st = tl.scrollTrigger;
			const at = sceneAnchors[link.getAttribute("href") ?? ""];
			if (!st || at === undefined) return;
			event.preventDefault();
			window.scrollTo({ top: st.start + (at / tl.duration()) * (st.end - st.start), behavior: "auto" });
		});
	});
}
