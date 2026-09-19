// Enlaces del navbar a secciones que viven DENTRO de la escena (no hay un ancla
// en el DOM a la que saltar): llevan al punto del scroll donde esa parte de la
// animación está en pantalla. El destino es la etiqueta del timeline con el mismo
// nombre que el href (`#features` -> etiqueta "features"; ver timing.ts y mount.ts).
export function bindNavAnchors(tl: gsap.core.Timeline) {
	document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach((link) => {
		const label = (link.getAttribute("href") ?? "").slice(1);
		if (!(label in tl.labels)) return;
		link.addEventListener("click", (event) => {
			const st = tl.scrollTrigger;
			if (!st) return;
			event.preventDefault();
			window.scrollTo({ top: st.start + (tl.labels[label] / tl.duration()) * (st.end - st.start), behavior: "auto" });
		});
	});
}
