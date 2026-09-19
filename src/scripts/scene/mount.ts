// Monta la escena de entrada del Home: consulta el DOM, mide, construye el timeline
// (un acto por módulo, en el mismo orden de siempre) y lo engancha al scroll.
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { queryScene } from "./dom";
import { prepareScene } from "./prepare";
import { ANCHOR_FEATURES_AT, ANCHOR_HOW_AT, TL_UNITS_BASE, TL_VIEWPORTS_BASE, RUMBLE_START } from "./timing";
import { addHeroStatsAct } from "./acts/hero-stats";
import { addLimitAct } from "./acts/limit";
import { addBurstAct } from "./acts/burst";
import { addTravelAct } from "./acts/travel";
import { setupFeatures, addFeaturesAct } from "./acts/features";
import { setupBlackhole, addFinaleAct } from "./acts/finale";
import { createOutro } from "./outro/outro";
import { bindNavAnchors } from "./anchors";

gsap.registerPlugin(ScrollTrigger);

export function mountScene() {
	const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	const refs = queryScene();

	if (!refs || reduceMotion) {
		// Faltan piezas del DOM (o hay reduced-motion): se abandona la escena y se
		// vuelve a la versión simple. Quitar el atributo basta: el CSS global muestra
		// las secciones static-only y oculta las scene-only.
		delete document.documentElement.dataset.scene;
		return;
	}

	// data-scene="on" ya lo puso el script de <head> de index.astro (el CSS global
	// alterna la escena y la versión simple con él, y el footer va en negro para
	// enlazar sin costura con el espacio).
	const { introScene } = refs;
	const m = prepareScene(refs);

	// El pin se crea ANTES de construir los actos, como siempre: al pinear,
	// ScrollTrigger le pone a #intro-scene un transform y una altura fija, y eso lo
	// convierte en el bloque contenedor de los elementos `fixed` de la escena. Las
	// medidas de layoutOutro (al construir el acto final) dependen de ello, así que
	// crear el pin después cambiaría la geometría del outro.
	//
	// Su largo, en cambio, es proporcional a la duración REAL del timeline: `end`
	// se evalúa de forma perezosa (invalidateOnRefresh) y un refresh al terminar de
	// construir lo recalcula con todos los actos ya añadidos. Se redondea a la
	// décima para que un retoque mínimo de un acto no cambie el ritmo del scroll.
	// Distancia fija en vez de "+=100%": ese porcentaje se mide sobre el alto del
	// propio elemento pineado, que aquí no es una referencia estable y llegó a
	// generar un spacer de más de 12000px.
	const tl = gsap.timeline({ paused: true });
	const sceneUnits = () => (tl.duration() > 0 ? Math.round(tl.duration() * 10) / 10 : TL_UNITS_BASE);
	const st = ScrollTrigger.create({
		animation: tl,
		trigger: introScene,
		start: "top top",
		end: () => `+=${window.innerHeight * TL_VIEWPORTS_BASE * (sceneUnits() / TL_UNITS_BASE)}`,
		scrub: 1,
		pin: true,
		invalidateOnRefresh: true,
	});

	addHeroStatsAct(tl, refs, m);
	addLimitAct(tl, refs, m);
	addBurstAct(tl, refs, m);
	addTravelAct(tl, refs, m);

	const { starRot } = setupFeatures(refs);
	setupBlackhole(refs);
	const outro = createOutro(refs);
	addFeaturesAct(tl, refs, starRot);
	addFinaleAct(tl, refs, outro);

	// Solo en desarrollo (Vite lo elimina del build): expone el timeline para
	// poder inspeccionar la escena por consola — tl.scrollTrigger.disable(false)
	// y tl.time(t) sitúan la escena en cualquier instante sin scrollear.
	if (import.meta.env.DEV) (window as unknown as { __introTl?: gsap.core.Timeline }).__introTl = tl;

	// El retumbo del agujero negro es en tiempo real: mientras la escena esté
	// pinada y el tiempo haya pasado de RUMBLE_START, se repinta cada frame aunque
	// el usuario no scrollee (si no, temblaría solo al mover el scroll).
	gsap.ticker.add(() => {
		if (outro.clock.t < RUMBLE_START || !tl.scrollTrigger?.isActive) return;
		outro.render(outro.clock.t);
	});

	tl.addLabel("features", ANCHOR_FEATURES_AT).addLabel("how", ANCHOR_HOW_AT);

	// Con todos los actos añadidos, la duración ya es la real: recalcula el largo.
	st.refresh();

	bindNavAnchors(tl);
}
