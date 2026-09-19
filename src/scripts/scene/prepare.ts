// Estado inicial de la escena y medidas previas. Todo se mide AQUÍ, de forma
// síncrona y antes de crear el timeline (nunca dentro de él): las medidas son
// las que luego usan los actos.
import { gsap } from "gsap";
import type { SceneRefs } from "./dom";

export function prepareScene(r: SceneRefs) {
	const {
		introScene,
		heroTitle,
		radarWrapper,
		radarPlane,
		statsSection,
		statNumbers,
		raidsNumber,
		raidsLabel,
		asymptoteGrid,
		asymptoteCurve,
		limitBlock,
		limitX,
		limitInfinityShake,
		burstDots,
	} = r;
	// <Stats/> se renderiza con los valores finales (es lo que ve la versión simple);
	// con la escena animada arrancan en cero y se cuentan hasta su valor al entrar.
	function resetStatValues() {
		statNumbers.forEach((el) => {
			const decimals = parseInt(el.dataset.decimals || "0", 10);
			const prefix = el.dataset.prefix || "";
			const suffix = el.dataset.suffix || "";
			el.textContent = `${prefix}${(0).toFixed(decimals)}${suffix}`;
		});
	}

	// data-scene="on" ya lo puso el script de <head> de index.astro (el CSS global
	// alterna la escena y la versión simple con él, y el footer va en negro para
	// enlazar sin costura con el espacio). Los stats se ponen a cero ANTES de
	// medir nada: las medidas de más abajo se toman con esos textos.
	resetStatValues();

	// Estado inicial: stats fuera de escena (debajo del viewport), superpuestas
	// en absoluto dentro de #intro-scene para que puedan compartir pantalla con
	// el hero mientras este se "encoge".
	// Las stats entran deslizándose desde abajo. Se anima `top` (no un
	// transform / yPercent) A PROPÓSITO: un transform en #stats lo convertiría
	// en el bloque contenedor de sus descendientes `position: fixed`, y en el
	// Acto 2 el número y la etiqueta de "Raids bloqueados" pasan justo a
	// `fixed` para viajar hasta el límite — necesitan referenciar el viewport,
	// no #stats.
	const STATS_TOP_REST = "64%";
	const STATS_TOP_START = "104%";
	gsap.set(statsSection, {
		position: "absolute",
		left: 0,
		right: 0,
		top: STATS_TOP_START,
		opacity: 0,
	});

	gsap.set(radarPlane, {
		transformPerspective: 1000,
		rotationZ: -30,
		rotationX: 60,
	});

	// Posición del borde superior de #intro-scene AHORA (página sin pinear, con
	// el header sticky ocupando su espacio arriba). Cuando ScrollTrigger pinea
	// la escena, #intro-scene queda fijado con su top en el viewport (y: 0),
	// así que todo lo que midamos ahora está `introSceneTop` px MÁS ABAJO de
	// donde se verá durante el pin. Restamos esta cifra a las posiciones que se
	// aplican como `fixed` durante el Acto 2. Como #intro-scene y las piezas se
	// miden en el mismo instante síncrono, la resta es válida haya el scroll
	// que haya (ambos rects se desplazan igual con el scroll).
	const introSceneTop = introScene!.getBoundingClientRect().top;

	// Acto 2 — preparar la curva para "dibujarse" (stroke-dasharray/dashoffset)
	// y la grilla oculta (clip de radio 0). En el desenlace el clip crece desde
	// el punto exacto del ∞ (se calcula abajo) hasta cubrir la pantalla.
	const curveLength = asymptoteCurve!.getTotalLength();
	gsap.set(asymptoteCurve, { strokeDasharray: curveLength, strokeDashoffset: curveLength });
	gsap.set(asymptoteGrid, { clipPath: "circle(0% at 50% 50%)" });
	// Amplitud del temblor del ∞ (0 = quieto); la sube el script en el desenlace.
	gsap.set(limitInfinityShake, { "--tremble": 0 });

	// El valor final de "Raids bloqueados" (ej. "89K+"). El número lo cuenta
	// el propio Acto 1 (es la celda real de <Stats/>); aquí solo reconstruimos
	// el mismo texto para poder medir con él el ancho definitivo más abajo.
	const raidsTarget = parseFloat(raidsNumber!.dataset.target || "0");
	const raidsDecimals = parseInt(raidsNumber!.dataset.decimals || "0", 10);
	const raidsPrefix = raidsNumber!.dataset.prefix || "";
	const raidsSuffix = raidsNumber!.dataset.suffix || "";
	const raidsText = `${raidsPrefix}${raidsTarget.toFixed(raidsDecimals)}${raidsSuffix}`;
	const raidsZeroText = `${raidsPrefix}${(0).toFixed(raidsDecimals)}${raidsSuffix}`;

	// Dónde quedan EN REPOSO el número y la etiqueta dentro de la grilla ya
	// asentada (top al valor final) y con el texto final ("89K+", no "0K+"),
	// para poder despegarlos desde ahí (FLIP) sin que peguen un salto.
	//
	// En la celda son <div> de bloque, centrados y con el line-height base
	// heredado, así que su getBoundingClientRect() NO coincide con dónde se
	// ven realmente los glifos. Medimos con un Range sobre el contenido: eso
	// da la caja ajustada al texto pintado (left/top/ancho reales). Al
	// despegar los ponemos `fixed` + inline-block + line-height 1, con lo que
	// su caja pasa a ser justo esa, y no hay salto. Todo síncrono: llevamos
	// las stats a reposo, medimos, y las devolvemos sin que se pinte nada.
	gsap.set(statsSection, { top: STATS_TOP_REST });
	raidsNumber!.textContent = raidsText;

	const measureRenderedText = (el: HTMLElement) => {
		const range = document.createRange();
		range.selectNodeContents(el);
		const r = range.getBoundingClientRect();
		// `top` corregido a coordenadas "de fase pineada" (ver introSceneTop).
		return { left: r.left, top: r.top - introSceneTop, width: r.width, height: r.height };
	};
	const numberRestRect = measureRenderedText(raidsNumber!);
	const labelRestRect = measureRenderedText(raidsLabel!);

	raidsNumber!.textContent = raidsZeroText;
	gsap.set(statsSection, { top: STATS_TOP_START });

	// Tamaño del título ya "formado": la etiqueta crece hasta el cuerpo del
	// número; el número no cambia de tamaño.
	const titleFontSize = parseFloat(window.getComputedStyle(raidsNumber!).fontSize) || 32;

	// Sufijo " = x" que se añade a la etiqueta cuando el "89K+" ocupa la "x":
	// deja leer "lim (…→∞) / Raids bloqueados = x". Vive dentro de #raids-label
	// (así se mueve/escala/estalla con ella); arranca oculto. El "=" en tono
	// tenue y la "x" en cursiva serif, como la "x" original del límite.
	const raidsEqx = document.createElement("span");
	raidsEqx.setAttribute("aria-hidden", "true");
	raidsEqx.style.cssText = "display:none;opacity:0;white-space:pre;font-weight:400;color:#6e6e6e;";
	raidsEqx.textContent = "  =  ";
	const raidsEqxVar = document.createElement("span");
	raidsEqxVar.textContent = "x";
	raidsEqxVar.style.cssText =
		'font-family:ui-serif,Georgia,"Times New Roman",serif;font-style:italic;color:#eeeeee;';
	raidsEqx.appendChild(raidsEqxVar);
	raidsLabel!.appendChild(raidsEqx);

	// Ancho de "Raids bloqueados = x" YA a tamaño de título (display, bold), con
	// el sufijo visible, para centrar ese conjunto bajo el bloque "lim" cuando
	// el "89K+" se marcha. Medida síncrona aplicando el estilo un instante.
	const _lst = raidsLabel!.style;
	const _lstPrev = {
		ff: _lst.fontFamily,
		fw: _lst.fontWeight,
		fs: _lst.fontSize,
		ws: _lst.whiteSpace,
	};
	_lst.fontFamily = "var(--font-display)";
	_lst.fontWeight = "700";
	_lst.fontSize = `${titleFontSize}px`;
	_lst.whiteSpace = "nowrap";
	raidsEqx.style.display = "inline";
	const labelFullWidth = measureRenderedText(raidsLabel!).width;
	raidsEqx.style.display = "none";
	_lst.fontFamily = _lstPrev.ff;
	_lst.fontWeight = _lstPrev.fw;
	_lst.fontSize = _lstPrev.fs;
	_lst.whiteSpace = _lstPrev.ws;

	// El bloque "lim / x → ∞" debe aparecer justo donde estaba el título del
	// hero (no en una esquina fija) — medimos el rect del título ya con el
	// pequeño desplazamiento hacia abajo que sufre en el Acto 1 (y: 50, ver
	// el tween más abajo), para que el límite aterrice exactamente donde el
	// título termina de estar cuando se desvanece. Mismo truco síncrono:
	// aplicamos el offset, medimos, y lo devolvemos a 0 sin que pinte nada
	// entre medio.
	gsap.set(heroTitle, { y: 50 });
	const heroTitleRect = heroTitle!.getBoundingClientRect();
	gsap.set(heroTitle, { y: 0 });

	// El bloque "lim / x → ∞" es bastante más alto que el título (letra
	// grande), así que para que quede realmente EN el lugar del título (no
	// solo con el mismo borde superior) lo centramos verticalmente sobre la
	// franja que ocupaba el título, conservando el mismo margen izquierdo.
	// Medimos su alto natural poniéndolo fixed en (0,0) un instante (ahí ya
	// tiene tamaño shrink-to-fit real, a diferencia de cuando está estático
	// ocupando el ancho completo de su contenedor).
	gsap.set(limitBlock, { position: "fixed", left: 0, top: 0 });
	const limitNaturalRect = limitBlock!.getBoundingClientRect();

	// Ajuste fino sobre la franja del título: lo corremos un poco a la derecha
	// y algo más arriba para que no quede pegado al margen izquierdo. Se aplica
	// en este gsap.set() —antes de medir xRect / limitBlockRect más abajo— para
	// que todo lo que se calcula a partir de su posición siga cuadrando.
	const LIMIT_OFFSET_X = 140;
	const LIMIT_OFFSET_Y = -48;
	const limitTop =
		heroTitleRect.top + heroTitleRect.height / 2 - limitNaturalRect.height / 2 + LIMIT_OFFSET_Y;
	gsap.set(limitBlock, { left: heroTitleRect.left + LIMIT_OFFSET_X, top: limitTop });

	// Medimos TODO por adelantado (nunca dentro del timeline con scrub — un
	// tl.call() ahí se dispararía cada vez que el scroll cruza ese punto, en
	// ambos sentidos, duplicando tweens). Ahora que limitBlock ya tiene su
	// posición final fijada arriba (solo se anima su opacity de acá en más,
	// que no afecta el layout), su rect y el de la "x" ya son definitivos.
	const xRect = limitX!.getBoundingClientRect();

	// Centro del ∞ en pantalla: de ahí sale el estallido de partículas y de ahí
	// emerge el plano cartesiano (círculo que crece). Como #limit-infinity-shake
	// cuelga de #limit-block (fixed), su rect ya es viewport y no se mueve
	// durante el pin. Lo pasamos a % del viewport para el clip-path de la
	// grilla, que durante el pin ocupa toda la pantalla.
	const infRect = limitInfinityShake!.getBoundingClientRect();
	const infCenterX = infRect.left + infRect.width / 2;
	const infCenterY = infRect.top + infRect.height / 2;
	const infXPct = (infCenterX / window.innerWidth) * 100;
	const infYPct = (infCenterY / window.innerHeight) * 100;

	// El título formado ("89K+ Raids bloqueados") aterriza justo debajo del
	// bloque "lim / x → ∞", alineado a su izquierda. El rect de limitBlock ya
	// es el definitivo (solo se anima su opacity, que no afecta layout).
	const limitBlockRect = limitBlock!.getBoundingClientRect();
	const titleLeft = limitBlockRect.left;
	const titleTop = limitBlockRect.bottom + 28;

	// Centros del radar y del bloque del límite: la onda expansiva del ∞
	// también los "desintegra", así que parte de las partículas del estallido
	// nacen de ahí (no solo del ∞) y esos elementos salen despedidos.
	const radarRect = radarWrapper!.getBoundingClientRect();
	const radarCenterX = radarRect.left + radarRect.width / 2;
	const radarCenterY = radarRect.top + radarRect.height / 2 - 70; // ~ajuste por el desplazamiento del Acto 1
	const limitCenterX = limitBlockRect.left + limitBlockRect.width / 2;
	const limitCenterY = limitBlockRect.top + limitBlockRect.height / 2;

	// Origen de cada partícula: ~3/5 del ∞, ~1/5 del radar, ~1/5 del límite.
	const burstOriginOf = (i: number) => {
		if (i % 5 === 0) return { x: radarCenterX, y: radarCenterY };
		if (i % 5 === 1) return { x: limitCenterX, y: limitCenterY };
		return { x: infCenterX, y: infCenterY };
	};
	burstDots.forEach((dot, i) => {
		const o = burstOriginOf(i);
		gsap.set(dot, { left: o.x, top: o.y, xPercent: -50, yPercent: -50, opacity: 0 });
	});

	// Destinos de cada pieza al formarse el título: el número a la izquierda y
	// la etiqueta pegada a su derecha (con el ancho del número ya a tamaño
	// final). LABEL_BASELINE_NUDGE afina el alineado vertical número/etiqueta.
	const LABEL_GAP = 12;
	const LABEL_BASELINE_NUDGE = 0;
	const numberTargetLeft = titleLeft;
	const numberTargetTop = titleTop;
	const labelTargetLeft = titleLeft + numberRestRect.width + LABEL_GAP;
	const labelTargetTop = titleTop + LABEL_BASELINE_NUDGE;
	// Cuando el "89K+" se marcha a ocupar la "x", la etiqueta (ya como "Raids
	// bloqueados = x") se recoloca CENTRADA respecto al bloque "lim": el centro
	// del conjunto coincide con el centro del límite.
	const labelReflowLeft = limitBlockRect.left + limitBlockRect.width / 2 - labelFullWidth / 2;

	// Posición final del número, centrado sobre la "x" del límite. Al llegar
	// ahí se encoge a NUMBER_ON_X_SIZE para caber en el hueco de la "x" sin
	// desbordarlo; centramos usando sus dimensiones YA encogidas (la caja se
	// contrae hacia su esquina sup-izq, que es el ancla left/top).
	const NUMBER_ON_X_SIZE = 22;
	// El "89K+" quedaba un pelín por encima de donde estaba la "x": lo bajamos
	// un poco con este nudge (px, positivo = más abajo).
	const NUMBER_ON_X_NUDGE_Y = 6;
	const numberOnXRatio = NUMBER_ON_X_SIZE / titleFontSize;
	const numberFinalLeft = xRect.left + xRect.width / 2 - (numberRestRect.width * numberOnXRatio) / 2;
	const numberFinalTop =
		xRect.top + xRect.height / 2 - (numberRestRect.height * numberOnXRatio) / 2 + NUMBER_ON_X_NUDGE_Y;
	return {
		STATS_TOP_REST,
		curveLength,
		raidsTarget,
		numberRestRect,
		labelRestRect,
		titleFontSize,
		raidsEqx,
		xRect,
		infCenterX,
		infCenterY,
		infXPct,
		infYPct,
		radarCenterX,
		radarCenterY,
		limitCenterX,
		limitCenterY,
		numberTargetLeft,
		numberTargetTop,
		labelTargetLeft,
		labelTargetTop,
		labelReflowLeft,
		numberFinalLeft,
		numberFinalTop,
		NUMBER_ON_X_SIZE,
	};
}

export type Measurements = ReturnType<typeof prepareScene>;
