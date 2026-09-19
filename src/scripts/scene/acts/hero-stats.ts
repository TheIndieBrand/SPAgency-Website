// Acto 1: el hero se desvanece y las estadísticas suben y cuentan hasta su valor.
import type { SceneRefs } from "../dom";
import type { Measurements } from "../prepare";

export function addHeroStatsAct(tl: gsap.core.Timeline, r: SceneRefs, m: Measurements) {
	const {
		navbar,
		heroTitle,
		heroSubtitle,
		heroActions,
		radarWrapper,
		radarPlane,
		statsSection,
		statNumbers,
	} = r;
	const { STATS_TOP_REST } = m;
	// El header se desvanece apenas arranca el scroll y no vuelve a aparecer
	// durante el resto de la escena (nada más lo vuelve a tocar después de
	// este tramo) — se saca de circulación también para clics, no solo visual.
	tl.to(navbar, { opacity: 0, y: -16, duration: 1.2, ease: "power1.inOut" }, 0).set(
		navbar,
		{ pointerEvents: "none" },
		1.2,
	);

	// El subtítulo y los botones se desvanecen de forma gradual (ocupan buena
	// parte del recorrido, no un golpe seco) — al final solo quedan el título,
	// las letras matemáticas de fondo y el radar.
	tl.to([heroSubtitle, heroActions], { opacity: 0, y: -16, duration: 2.2, ease: "power1.inOut" }, 0)
		// El título baja un poco (en vez de subir pegado al radar) para quedar
		// mejor centrado en el espacio que deja el subtítulo/botones al
		// desvanecerse, en vez de quedar pegado arriba del hero.
		.to(heroTitle, { y: 50, duration: 3, ease: "power1.inOut" }, 0)
		// El radar sube y se achica un poco para dejarle sitio a las
		// estadísticas en vez de quedar pegado al título.
		.to(radarWrapper, { y: -70, scale: 0.94, duration: 3, ease: "power1.inOut" }, 0)
		// El radar cambia de rotación a lo largo de todo el scroll.
		.to(radarPlane, { rotationZ: 15, rotationX: 72, duration: 3, ease: "none" }, 0)
		// Las estadísticas suben y se asientan un poco después del centro (se
		// anima `top`, no un transform — ver el gsap.set inicial de statsSection).
		.to(statsSection, { top: STATS_TOP_REST, opacity: 1, duration: 2, ease: "power2.out" }, 0.8);

	// Cada número cuenta de 0 a su valor real mientras las stats terminan de
	// asentarse.
	statNumbers.forEach((el) => {
		const target = parseFloat(el.dataset.target || "0");
		const decimals = parseInt(el.dataset.decimals || "0", 10);
		const prefix = el.dataset.prefix || "";
		const suffix = el.dataset.suffix || "";
		const counter = { val: 0 };

		tl.to(
			counter,
			{
				val: target,
				duration: 1.2,
				ease: "power1.out",
				onUpdate: () => {
					el.textContent = `${prefix}${counter.val.toFixed(decimals)}${suffix}`;
				},
			},
			1.7,
		);
	});
}
