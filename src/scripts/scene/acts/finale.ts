// Acto final: el agujero negro cruza y vuelve, la comunidad sube, y el reloj
// del outro (un solo tween lineal) alimenta renderOutro en cada frame.
import { gsap } from "gsap";
import type { SceneRefs } from "../dom";
import type { Outro } from "../outro/outro";
import {
	OUTRO_LINE_AT,
	LINE_CENTER_AT,
	BLACKHOLE_START_OFFSET,
	BLACKHOLE_CROSS_DUR,
	OUTRO_END,
	BLACKHOLE_DEFAULT_YAW,
	COMMUNITY_HEADING_AT,
	COMMUNITY_FADE_AT,
	COMMUNITY_FADE_DUR,
	DIVE_START,
	DIVE_DUR,
} from "../timing";

export function setupBlackhole(r: SceneRefs) {
	const { outroBlackhole } = r;
	// Agujero negro: centrado en X, BAJADO medio viewport (su centro cae en el
	// borde inferior → solo asoma la mitad superior). Arranca fuera de pantalla
	// por la derecha, así el IntersectionObserver del componente lo mantiene
	// PAUSADO (no gasta GPU) hasta que entra en cuadro en el tramo final.
	gsap.set(outroBlackhole, {
		xPercent: -50,
		yPercent: -50,
		x: () => window.innerWidth * 1.2,
		y: () => window.innerHeight * 0.5,
		opacity: 0,
	});
}

export function addFinaleAct(tl: gsap.core.Timeline, r: SceneRefs, outro: Outro) {
	const { community, outroBlackholeCanvas } = r;
	const { clock: outroClock, render: renderOutro } = outro;
	const blackholeOrbit = { yaw: BLACKHOLE_DEFAULT_YAW };

	tl
		// …y la asíntota nueva se DIBUJA de izquierda a derecha. El trazo NO se
		// escala (clip-path, no scaleX) → no "se estira". La estrellita es la
		// punta que avanza; el extremo izquierdo del trazo nace fuera de pantalla
		// → nunca se ve un corte. Queda tendida cerca del borde derecho.
		// Reloj del acto final: un solo tween lineal que vale, en todo momento, el
		// tiempo del propio timeline. En cada frame renderOutro deriva de él TODO
		// lo que sigue a la cámara — la estrellita y el trazo de la asíntota, el
		// fondo de estrellas y las tarjetas de la comunidad — así no pueden
		// desincronizarse. (El agujero negro NO cuelga de aquí: va por sus
		// tweens de más abajo, sin cambios.)
		.fromTo(
			outroClock,
			{ t: OUTRO_LINE_AT },
			{
				t: OUTRO_END,
				duration: OUTRO_END - OUTRO_LINE_AT,
				ease: "none",
				onUpdate: () => renderOutro(outroClock.t),
				immediateRender: false,
			},
			OUTRO_LINE_AT,
		);

	tl
		// 7) EL AGUJERO NEGRO. Se cruza en el tramo final: entra por la derecha,
		//    bajo (solo asoma la mitad superior), la "cámara" pasa de largo y
		//    sale por la izquierda. Movimiento constante, lento. Su posición (y
		//    su vuelta por debajo en la parte B) la calcula renderOutro, no un
		//    tween: así el cruce y la vuelta salen de la misma fuente.
		// El propio agujero negro también "vive" mientras cruza: sin esto es una
		// sprite rígida deslizándose. BLACKHOLE_DEFAULT_YAW tiene que coincidir
		// con DEFAULT_YAW de BlackHole.astro (es el punto de partida del giro).
		// Como el disco es simétrico alrededor del eje de la cámara, orbitar en
		// yaw no cambia el contorno del anillo, pero SÍ barre el arco de
		// Doppler-beaming (el lado "brillante" del disco) alrededor del agujero
		// y desliza el fondo de estrellas que se ve a través — se lee como un
		// giro real, no un simple desplazamiento.
		.to(
			blackholeOrbit,
			{
				yaw: BLACKHOLE_DEFAULT_YAW + 1.3,
				duration: BLACKHOLE_CROSS_DUR,
				ease: "none",
				onUpdate: () =>
					outroBlackholeCanvas?.dispatchEvent(new CustomEvent("blackhole:orbit", { detail: { yaw: blackholeOrbit.yaw } })),
			},
			LINE_CENTER_AT + BLACKHOLE_START_OFFSET,
		)
		// Al volver por debajo (parte B) sigue girando despacio, retomando el
		// rumbo donde lo dejó el cruce.
		.to(
			blackholeOrbit,
			{
				yaw: BLACKHOLE_DEFAULT_YAW + 1.3 + 1.2,
				duration: DIVE_START - (LINE_CENTER_AT + 35),
				ease: "none",
				onUpdate: () =>
					outroBlackholeCanvas?.dispatchEvent(new CustomEvent("blackhole:orbit", { detail: { yaw: blackholeOrbit.yaw } })),
			},
			LINE_CENTER_AT + 35,
		)
		// En la caída gira cada vez más deprisa (arrastra el brillo Doppler y las
		// estrellas alrededor del disco: sensación de remolino).
		.to(
			blackholeOrbit,
			{
				yaw: BLACKHOLE_DEFAULT_YAW + 1.3 + 1.2 + 2.2,
				duration: DIVE_DUR,
				ease: "power2.in",
				onUpdate: () =>
					outroBlackholeCanvas?.dispatchEvent(new CustomEvent("blackhole:orbit", { detail: { yaw: blackholeOrbit.yaw } })),
			},
			DIVE_START,
		)
		// 8) LA COMUNIDAD. Cuando el agujero negro ya casi ha salido por la
		//    izquierda aparece el encabezado (centrado) y, al acabar el giro,
		//    suben desde abajo los testimonios (todos), centrados en pantalla, con
		//    la asíntota cayendo a su derecha. Su movimiento NO es un tween
		//    propio: las tarjetas son del mundo de la cámara (ver renderOutro) y
		//    suben lo que ella baja. La ventana tiene máscara: se funden bajo el
		//    encabezado en vez de pisarlo. La última tarjeta se asienta cerca del
		//    borde inferior; al soltar el pin el contenido sigue subiendo con el
		//    scroll a un ritmo parecido, sin corte.
		.to(community, { opacity: 1, duration: 1, ease: "power1.out" }, COMMUNITY_HEADING_AT)
		// 9) REMATE. Con la última tarjeta centrada y leída, el encabezado y todas
		//    las tarjetas se desvanecen a la vez para dar paso a la sección
		//    siguiente; después la asíntota se coloca en el centro (ver settle en
		//    renderOutro) y la cámara, que ya frenó, deja un plano quieto.
		.to(community, { opacity: 0, duration: COMMUNITY_FADE_DUR, ease: "none" }, COMMUNITY_FADE_AT);
}
