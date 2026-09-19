// Escena de entrada del Home: el Hero se "pinea" mientras el usuario hace
// scroll, el subtítulo y los botones se desvanecen, el radar cambia de
// rotación, y las estadísticas suben desde abajo y se asientan un poco
// después del centro, contando desde 0 hasta su valor real.
//
// Acto 2: aparece "lim / x ⟶ ∞" en el hueco del título del hero; el número
// "89K+" y la etiqueta "Raids bloqueados" se despegan de la grilla de stats y
// se forman como título debajo del límite. Mientras se recolocan: brotan más
// símbolos matemáticos por la pantalla, el radar gira algo más y las otras
// casillas de stats se separan y caen desvaneciéndose. Luego el número se
// encoge hasta ocupar la "x" (que se desvanece).
//
// Desenlace: el "89K+" se dispara contando hasta un número titánico, el ∞
// empieza a temblar y ¡zas! el plano cartesiano emerge desde el infinito
// (esquina sup-der) y la curva/función crece. Después todo deriva a la
// izquierda, cruza un agujero negro que curva la asíntota hacia abajo, y en el
// hueco que deja suben, en carrusel, los testimonios de la comunidad.
//
// Es la primera pieza de GSAP del sitio — pensada para irse ampliando
// (más escenas, más secciones) sin tocar esta base.
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { createStarField } from "./star-field";
import { createStepsAct, hitStopFactor, STEP_CONTACT_OFFSETS, STEP_RADIUS, wobble } from "./steps-act";

gsap.registerPlugin(ScrollTrigger);

const navbar = document.getElementById("navbar");
const introScene = document.getElementById("intro-scene");
const heroContent = document.getElementById("hero-content");
const heroTitle = document.querySelector<HTMLElement>("#hero h1");
const heroSubtitle = document.getElementById("hero-subtitle");
const heroActions = document.getElementById("hero-actions");
const radarWrapper = document.getElementById("radar-wrapper");
const radarPlane = document.querySelector<HTMLElement>(".radar-plane");
const statsSection = document.getElementById("stats");
const statNumbers = document.querySelectorAll<HTMLElement>(".stat-number");
// El título "89K+ Raids bloqueados" del Acto 2 se forma con estas dos piezas
// REALES de <Stats/> (segunda celda): el número y la etiqueta que va debajo.
const raidsNumber = (statNumbers[1] as HTMLElement | undefined) ?? null;
const raidsLabel = (raidsNumber?.nextElementSibling as HTMLElement | null) ?? null;
const raidsCell = (raidsNumber?.parentElement as HTMLElement | null) ?? null;
// Las cuatro casillas de la grilla: en el Acto 2 se separan y caen mientras la
// sección se desvanece. La de "Raids bloqueados" también (aunque ya tenga el
// contenido despegado), para que no quede parada y descolocada.
const statCells = Array.from(statNumbers)
	.map((n) => n.parentElement as HTMLElement | null)
	.filter((cell): cell is HTMLElement => cell != null);

const asymptoteScene = document.getElementById("asymptote-scene");
const asymptoteGrid = document.getElementById("asymptote-grid");
const gridLines = document.getElementById("grid-lines");
const curveTilt = document.getElementById("curve-tilt");
const outroLine = document.getElementById("outro-line");
const outroPath = document.getElementById("outro-path") as unknown as SVGPathElement | null;
const outroLineStar = document.getElementById("outro-line-star");
const outroStarLayer = document.getElementById("outro-star-layer");
const outroWorld = document.getElementById("outro-world") as unknown as SVGGElement | null;
const routeDots = document.getElementById("route-dots") as unknown as SVGPathElement | null;
const routeGrad = document.getElementById("route-grad") as unknown as SVGLinearGradientElement | null;
const stepNodes = Array.from(document.querySelectorAll<HTMLElement>(".step-node"));
const stepsWorld = document.getElementById("steps-world");
const diveVignette = document.getElementById("dive-vignette");
const diveBlack = document.getElementById("dive-black");
const diveBloom = document.getElementById("dive-bloom");
const diveSpark = document.getElementById("dive-spark");
const ctaScene = document.getElementById("cta-scene");
const ctaCard = document.getElementById("cta-scene-card");
const ctaLink = document.getElementById("cta-scene-link");
const community = document.getElementById("community");
const communityHeading = document.getElementById("community-heading");
const communityWindow = document.getElementById("community-window");
const communityTrack = document.getElementById("community-track");
const outroBlackhole = document.getElementById("outro-blackhole");
const outroBlackholeCanvas = outroBlackhole?.querySelector<HTMLCanvasElement>("canvas[data-blackhole]") ?? null;
const asymptoteDrift = document.getElementById("asymptote-drift");
const asymptoteCurve = document.getElementById("asymptote-curve") as unknown as SVGPathElement | null;
const limitBlock = document.getElementById("limit-block");
const limitX = document.getElementById("limit-x");
const limitArrow = document.getElementById("limit-arrow");
const limitInfinityShake = document.getElementById("limit-infinity-shake");
const asymptoteCurveHead = document.getElementById("asymptote-curve-head");
const curveHeadDot = document.getElementById("curve-head-dot");
const curveHeadStar = document.getElementById("curve-head-star");
const spaceBg = document.getElementById("space-bg");
const spaceStars = document.getElementById("space-stars");
const spaceStarsCanvas = document.getElementById("space-stars-canvas") as HTMLCanvasElement | null;
const spaceFeatures = document.getElementById("space-features");
const moon = document.getElementById("moon");
const spaceFeaturesHeading = document.getElementById("space-features-heading");
const spaceFeaturesSub = document.getElementById("space-features-sub");
const spaceFeaturesCards = document.getElementById("space-features-cards");
const curveProj = document.getElementById("curve-proj");
const curveProjX = document.getElementById("curve-proj-x");
const curveProjY = document.getElementById("curve-proj-y");
const curveProjLabels = document.getElementById("curve-proj-labels");
const curveProjXLabel = document.getElementById("curve-proj-x-label");
const curveProjYLabel = document.getElementById("curve-proj-y-label");
const asymptoteGlyphLayer = document.getElementById("asymptote-glyph-layer");
const travelCaption1 = document.getElementById("travel-caption-1");
const travelCaption2 = document.getElementById("travel-caption-2");
const asymptoteGlyphs = document.querySelectorAll<HTMLElement>(".asymptote-glyph");
const burstDots = document.querySelectorAll<HTMLElement>(".limit-burst-dot");

function setFinalStatValues() {
	statNumbers.forEach((el) => {
		const target = parseFloat(el.dataset.target || "0");
		const decimals = parseInt(el.dataset.decimals || "0", 10);
		const prefix = el.dataset.prefix || "";
		const suffix = el.dataset.suffix || "";
		el.textContent = `${prefix}${target.toFixed(decimals)}${suffix}`;
	});
}

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const hasAllPieces = Boolean(
	navbar &&
		introScene &&
		heroContent &&
		heroTitle &&
		heroSubtitle &&
		heroActions &&
		radarWrapper &&
		radarPlane &&
		statsSection &&
		raidsNumber &&
		raidsLabel &&
		asymptoteScene &&
		asymptoteGrid &&
		gridLines &&
		curveTilt &&
			outroLine &&
			outroPath &&
			community &&
			communityHeading &&
			communityWindow &&
			communityTrack &&
			outroLineStar &&
			outroStarLayer &&
			outroWorld &&
			routeDots &&
			routeGrad &&
			stepNodes.length === 3 &&
			stepsWorld &&
			diveVignette &&
			diveBlack &&
			diveBloom &&
			diveSpark &&
			ctaScene &&
			ctaCard &&
			ctaLink &&
			outroBlackhole &&
		asymptoteDrift &&
		asymptoteCurve &&
		limitBlock &&
		limitX &&
		limitArrow &&
		limitInfinityShake &&
		asymptoteCurveHead &&
		curveHeadDot &&
		curveHeadStar &&
		spaceBg &&
		spaceStars &&
		spaceStarsCanvas &&
		spaceFeatures &&
		moon &&
		spaceFeaturesHeading &&
		spaceFeaturesSub &&
		spaceFeaturesCards &&
		curveProj &&
		curveProjX &&
		curveProjY &&
		curveProjLabels &&
		curveProjXLabel &&
		curveProjYLabel &&
		asymptoteGlyphLayer &&
		travelCaption1 &&
		travelCaption2,
);

if (hasAllPieces && !reduceMotion) {
	// La escena animada termina en el negro del espacio: el CSS global del
	// footer usa este atributo para ir también en negro (sin costura).
	document.documentElement.dataset.scene = "on";

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

	// Duración total del timeline en unidades. Con scrub, el scroll se reparte
	// proporcional a ella, así que al alargar la escena hay que alargar el pin
	// en la misma proporción o todos los actos anteriores irían más rápido por
	// píxel. TL_UNITS_BASE es la duración con la que se ajustó el ritmo original
	// (12.6 alturas de viewport); TL_UNITS es la actual (acto final de la
	// comunidad incluido) y se comprueba contra tl.duration() al final del
	// montaje. Ambas son literales porque el ScrollTrigger evalúa `end` al
	// crearse, antes de que existan las constantes de tiempo de más abajo.
	const TL_UNITS_BASE = 54.3;
	const TL_UNITS = 95.6;
	const TL_VIEWPORTS_BASE = 12.6;

	const tl = gsap.timeline({
		scrollTrigger: {
			trigger: introScene,
			start: "top top",
			// Distancia fija (acto 1 + acto 2 + desenlace) en vez de "+=100%":
			// ese porcentaje se mide sobre el alto del propio elemento pineado,
			// que aquí no es una referencia estable y llegó a generar un spacer
			// de más de 12000px.
			end: () => `+=${window.innerHeight * TL_VIEWPORTS_BASE * (TL_UNITS / TL_UNITS_BASE)}`,
			scrub: 1,
			pin: true,
			invalidateOnRefresh: true,
		},
	});

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

	// ============ ACTO 2: el límite hacia el infinito ============
	// Paso 1: el título antiguo del hero se desvanece y, SOLAPÁNDOSE con él,
	// entra el límite "lim / x ⟶ ∞" (ya posicionado sobre el rect que ocupaba
	// el título). Enseguida —sin pausa— arranca la formación del título (Paso
	// 2), para que la aparición del límite y lo que viene se sientan como un
	// solo gesto y no como dos beats separados.
	//
	// El contenedor #asymptote-scene se hace visible solo para poder mostrar
	// el bloque del límite; la cuadrícula (#asymptote-grid) sigue recortada a
	// nada hasta el desenlace.
	tl.to(asymptoteScene, { opacity: 1, duration: 0.5, ease: "none" }, 3.2)
		.to(heroTitle, { opacity: 0, duration: 0.6, ease: "power1.out" }, 3.2)
		// Solapa el final del fundido del título (no espera a que termine).
		.to(limitBlock, { opacity: 1, duration: 0.7, ease: "none" }, 3.6);

	// ---- El título "89K+ Raids bloqueados" se FORMA a partir de la grilla ----
	// La segunda celda suelta sus dos piezas REALES: el número "89K+" se
	// despega de su sitio y, a la vez, la etiqueta "Raids bloqueados" se
	// agranda y se coloca justo a su lado, ya debajo del límite. Como son los
	// elementos reales de <Stats/>, el título se "forma" en vez de aparecer de
	// la nada. (El resto de la grilla se separa y se desvanece — ver (c) más
	// abajo. El radar sigue en pantalla, solo rota un poco más.)

	// PENDIENTE — el radar sigue visible por ahora (se apagará en un paso
	// posterior). Código conservado:
	// tl.to(radarWrapper, { opacity: 0, duration: 0.6, ease: "power1.out" }, 5.4);

	// Al despegar (4.2) el número y la etiqueta salen del DOM de su celda y se
	// cuelgan de #asymptote-scene. Hace falta porque en (c) la celda ya vacía
	// se mueve con un transform, y un ancestro transformado pasaría a ser el
	// bloque contenedor de estos elementos `position: fixed`, descolocándolos.
	//
	// El reparent y el paso a `fixed` van JUNTOS en el mismo callback (y a la
	// misma posición 4.2) para que no exista ni un frame con el elemento ya
	// reparentado pero aún en flujo normal — eso lo pintaba un instante en la
	// esquina superior izquierda de #asymptote-scene. `reattach` a 4.1 deshace
	// el reparent y limpia estilos para volver a la grilla. Ambos callbacks
	// están guardados: idempotentes y válidos en cualquier sentido del scroll.
	const numberDetachVars = {
		position: "fixed",
		display: "inline-block",
		left: numberRestRect.left,
		top: numberRestRect.top,
		margin: 0,
		lineHeight: "1",
		zIndex: 50,
	};
	const labelDetachVars = {
		position: "fixed",
		display: "inline-block",
		left: labelRestRect.left,
		top: labelRestRect.top,
		margin: 0,
		zIndex: 50,
		whiteSpace: "nowrap",
		fontFamily: "var(--font-display)",
		fontWeight: 400,
		color: "#6e6e6e", // = --color-text-faint (punto de partida explícito para GSAP)
		lineHeight: "1",
	};
	const detachPieces = () => {
		if (asymptoteScene && raidsNumber!.parentElement !== asymptoteScene) {
			asymptoteScene.appendChild(raidsNumber!);
			asymptoteScene.appendChild(raidsLabel!);
		}
		gsap.set(raidsNumber!, numberDetachVars);
		gsap.set(raidsLabel!, labelDetachVars);
	};
	const reattachPieces = () => {
		if (raidsCell && raidsNumber!.parentElement !== raidsCell) {
			raidsCell.appendChild(raidsNumber!);
			raidsCell.appendChild(raidsLabel!);
		}
		gsap.set([raidsNumber!, raidsLabel!], {
			clearProps:
				"position,display,left,top,margin,lineHeight,zIndex,whiteSpace,fontFamily,fontWeight,color,fontSize,x,y",
		});
	};

	tl.call(reattachPieces, undefined, 4.1)
		.call(detachPieces, undefined, 4.2)
		// "primero: el 89K+ sale de su posición" — viaja hasta debajo del límite.
		.to(
			raidsNumber,
			{ left: numberTargetLeft, top: numberTargetTop, duration: 1.8, ease: "power2.inOut" },
			4.2,
		)
		// "a la vez: la etiqueta se convierte en grande y se reposiciona al lado".
		.to(
			raidsLabel,
			{
				left: labelTargetLeft,
				top: labelTargetTop,
				fontSize: titleFontSize,
				duration: 1.8,
				ease: "power2.inOut",
			},
			4.2,
		)
		// Transición suave de "Raids bloqueados" tenue → título: el peso sube
		// 400→700 (GSAP lo escalona por 500/600, no da el salto seco) y el color
		// pasa de tenue a pleno. Dura menos que el viaje, así llega ya formado.
		.to(
			raidsLabel,
			{ fontWeight: 700, color: "#eeeeee", duration: 1, ease: "power1.inOut" },
			4.2,
		);

	// Mientras el título se está recolocando (≈4.2–6.0) pasan tres cosas más:

	// (a) Aparecen más símbolos matemáticos repartidos por toda la pantalla,
	//     con un pequeño stagger aleatorio y entrando desde algo más abajo y
	//     encogidos, para que "broten" en vez de encenderse de golpe.
	if (asymptoteGlyphs.length) {
		gsap.set(asymptoteGlyphs, { y: 12, scale: 0.8 });
		tl.to(
			asymptoteGlyphs,
			{
				opacity: 0.16,
				y: 0,
				scale: 1,
				duration: 1.6,
				ease: "power2.out",
				stagger: { each: 0.07, from: "random" },
			},
			4.2,
		);
	}

	// (b) El radar gira un poco más (sigue desde donde lo dejó el Acto 1).
	tl.to(
		radarPlane,
		{ rotationZ: "+=14", rotationX: "+=7", duration: 1.8, ease: "power1.inOut" },
		4.2,
	);

	// (c) Las CUATRO casillas de stats se abren en abanico desde el centro y
	//     caen hacia abajo, con arranque escalonado para que no se vayan a la
	//     vez. La segunda (ya con su contenido despegado) va también, con un
	//     desplazamiento pequeño, para que no quede parada mientras las demás
	//     se mueven. El desvanecimiento lo hace el fundido de toda la sección
	//     (justo debajo), así se va también el marco de la grilla.
	if (statCells.length) {
		tl.to(
			statCells,
			{
				x: (i: number) => [-115, -45, 55, 120][i] ?? 0,
				y: (i: number) => [90, 108, 82, 96][i] ?? 90,
				duration: 2.6,
				ease: "power1.in",
				stagger: 0.16,
			},
			4.2,
		);
	}
	// Fundido largo de toda la sección de stats (marco + casillas + hueco
	// vacío) — "que tarden en desvanecer".
	tl.to(statsSection, { opacity: 0, duration: 3, ease: "power1.in" }, 4.2);

	// Una vez formado el título, el "89K+" sigue viaje hasta ocupar el hueco de
	// la "x" del límite, encogiéndose a la vez para caber (NUMBER_ON_X_SIZE),
	// mientras la "x" se desvanece. La etiqueta "Raids bloqueados" se queda
	// quieta ahí. Reafirmamos antes (idempotente) las posiciones ya formadas.
	tl.set(raidsLabel, { position: "fixed", left: labelTargetLeft, top: labelTargetTop }, 6.4)
		.set(raidsNumber, { position: "fixed", left: numberTargetLeft, top: numberTargetTop }, 6.4)
		.to(
			raidsNumber,
			{
				left: numberFinalLeft,
				top: numberFinalTop,
				fontSize: NUMBER_ON_X_SIZE,
				duration: 1,
				ease: "power2.inOut",
			},
			6.4,
		)
		// La etiqueta se recoloca CENTRADA bajo el límite y, a la vez, aparece
		// el sufijo " = x": queda "Raids bloqueados = x" alineado al centro del
		// bloque "lim".
		.to(raidsLabel, { left: labelReflowLeft, duration: 1, ease: "power2.inOut" }, 6.4)
		.set(raidsEqx, { display: "inline" }, 6.4)
		.to(raidsEqx, { opacity: 1, duration: 0.5, ease: "power1.out" }, 6.45)
		// La "x" se desvanece pronto, mientras el número aún va de camino.
		.to(limitX, { opacity: 0, duration: 0.4, ease: "none" }, 6.5);

	// ================= DESENLACE (el título ya está sobre la "x") =============

	// El "89K+" se dispara: cuenta desde 89K hacia un número titánico, cada vez
	// más rápido (power2.in), recentrándose sobre la "x" a cada frame para que
	// no se descuadre al ensancharse. Mismo mecanismo que el contador de stats.
	const fmtTitanic = (n: number): string => {
		if (n >= 1_000_000) return `${+(n / 1_000_000).toFixed(1)}B+`;
		if (n >= 1_000) return `${+(n / 1_000).toFixed(1)}M+`;
		return `${Math.round(n)}K+`;
	};
	const xCenterX = xRect.left + xRect.width / 2;
	const titanicCounter = { k: raidsTarget };
	tl.to(
		titanicCounter,
		{
			k: 8_800_000,
			duration: 2.2,
			ease: "power2.in",
			onUpdate: () => {
				raidsNumber!.textContent = fmtTitanic(titanicCounter.k);
				gsap.set(raidsNumber!, {
					left: xCenterX - raidsNumber!.getBoundingClientRect().width / 2,
				});
			},
		},
		7.6,
	)
		// La flecha "⟶" se apaga para dejarle sitio al número que se ensancha.
		.to(limitArrow, { opacity: 0, duration: 0.8, ease: "power1.out" }, 7.6);

	// El ∞ empieza a temblar PRONTO y cada vez más fuerte (la animación CSS ya
	// corre; aquí solo subimos su amplitud de 0 a 1) — es el "cargando" largo
	// antes de estallar.
	tl.to(limitInfinityShake, { "--tremble": 1, duration: 2.6, ease: "power2.in" }, 7.4);

	// ---- ¡EL ∞ ESTALLA! (pos 10.0) ----
	// El ∞ desaparece y su onda expansiva se lleva por delante el radar, el
	// bloque del límite y el título "89K+ Raids bloqueados": salen despedidos y
	// se desintegran en partículas que se arrastran hacia fuera. Solo queda el
	// plano cartesiano emergiendo (y los símbolos tenues del fondo).
	const BURST_POS = 10.0;
	const burstReach = Math.hypot(window.innerWidth, window.innerHeight);

	// 1. El ∞ desaparece de golpe.
	tl.to(limitInfinityShake, { opacity: 0, duration: 0.12, ease: "none" }, BURST_POS);

	// 2. Las partículas salen disparadas desde su origen (∞ / radar / límite).
	//    Las del ∞ vuelan lejos y rápido (cruzan el borde); las del radar y el
	//    límite van algo más lentas y cortas, para que "se arrastren".
	burstDots.forEach((dot, i) => {
		const fromInf = i % 5 >= 2;
		const angle = i * 2.399963 + (i % 3) * 0.5; // reparto tipo "girasol"
		const reach = fromInf
			? burstReach * (0.6 + ((i * 3) % 12) / 18)
			: burstReach * (0.3 + ((i * 5) % 10) / 26);
		const travel = fromInf ? 1.6 : 2.3;
		const at = BURST_POS + i * 0.012;
		tl.to(dot, { opacity: fromInf ? 1 : 0.85, duration: 0.1, ease: "none" }, at)
			.to(
				dot,
				{
					x: Math.cos(angle) * reach,
					y: Math.sin(angle) * reach,
					rotation: "random(-90, 90)",
					duration: travel,
					ease: fromInf ? "power3.out" : "power2.out",
				},
				at,
			)
			.to(
				dot,
				{ opacity: 0, duration: fromInf ? 0.7 : 1.2, ease: "power1.in" },
				at + (fromInf ? 0.7 : 0.9),
			);
	});

	// 3. Radar, límite y título salen despedidos en la dirección contraria al ∞,
	//    encogiéndose, girando y desvaneciéndose (como si la onda los rompiera).
	const flingAway = (el: Element | Element[], cx: number, cy: number, dist: number) => {
		const dx = cx - infCenterX;
		const dy = cy - infCenterY;
		const len = Math.hypot(dx, dy) || 1;
		tl.to(
			el,
			{
				x: `+=${((dx / len) * dist).toFixed(1)}`,
				y: `+=${((dy / len) * dist).toFixed(1)}`,
				rotation: "random(-14, 14)",
				scale: 0.8,
				opacity: 0,
				duration: 1.1,
				ease: "power2.in",
			},
			BURST_POS + 0.04,
		);
	};
	flingAway(radarWrapper!, radarCenterX, radarCenterY, 380);
	flingAway(limitBlock!, limitCenterX, limitCenterY, 300);
	flingAway([raidsNumber!, raidsLabel!], limitCenterX, limitCenterY, 320);

	// 4. De ese punto estallado emerge el plano cartesiano: un círculo que crece
	//    DESDE el ∞ (infX/Y %) hasta cubrir la pantalla. Progresivo (power2.out,
	//    ~2s) para que se vea crecer, no aparecer de golpe. Nada más se
	//    desvanece: el plano se queda y se lo lleva el scroll normal al
	//    despinearse.
	tl.fromTo(
		asymptoteGrid,
		{ clipPath: `circle(0% at ${infXPct}% ${infYPct}%)` },
		{ clipPath: `circle(175% at ${infXPct}% ${infYPct}%)`, duration: 2, ease: "power2.out" },
		BURST_POS + 0.18,
	);

	// 5. EL VIAJE. La curva/función se dibuja a RITMO CONSTANTE (ease "none") y
	//    durante MUCHÍSIMO scroll; nunca termina de dibujarse (FRAC_C_END < 1)
	//    → siempre "sigue creciendo hacia el infinito".
	//
	//    Fase A (frac ≤ FRAC_A_END): la cámara NO sigue de entrada; solo cuando
	//    la punta pasa ~media pantalla (FOLLOW_START_X) engancha con smoothstep
	//    (sin tirón), clava la punta ahí en X y en Y sigue su desplazamiento
	//    amortiguado (VERT_FOLLOW).
	//    Fase B (≤ FRAC_B_END): la curva se dispara casi vertical — la cámara la
	//    SIGUE hacia arriba (X estable, Y casi 1:1) → subimos al "espacio".
	//    Fase C (> FRAC_B_END): la cámara CLAVA la punta en un punto fijo
	//    arriba-izquierda (TIP_SCREEN_X/Y) → el extremo se ve siempre y el trazo
	//    fluye hacia abajo dando sensación de crecer. La mitad derecha queda
	//    libre para la sección Funciones.
	const FOLLOW_START_X = 500; // viewBox X (~media pantalla) a partir del cual sigue
	const FOLLOW_RAMP = 220; // units sobre los que engancha (smoothstep)
	const VERT_FOLLOW = 0.6; // amortiguación del seguimiento vertical en fase A (sutil)
	const VERT_FOLLOW_B = 0.9; // seguimiento vertical en fase B (subida al espacio)
	// Fracciones de curva DIBUJADA que delimitan cada fase del viaje:
	const FRAC_A_END = 0.32; // fin de fase A (viaje por el plano)
	const FRAC_B_END = 0.43; // fin de fase B (subida al espacio)
	const FRAC_C_END = 0.97; // hasta aquí se dibuja (nunca 1 → "sigue creciendo hacia el ∞")
	// En fase C la punta se CLAVA en este punto de la pantalla (viewBox 1000x600):
	// arriba-izquierda, para que se vea siempre y deje libre la mitad derecha.
	const TIP_SCREEN_X = 150;
	const TIP_SCREEN_Y = 200;
	const C_TURN = 0.12; // tramo inicial de la fase C en el que la cámara engancha
	const GLYPH_PARALLAX = 0.62; // el fondo de letras se mueve menos que la cámara
	// Giro del outro para la sección Funciones (grados). Signo = sentido.
	const CARDS_SPIN = 90;
	// Cuánto BAJA el bloque título+cards ya girado (fracción del alto de
	// viewport), para dejar hueco a la asíntota nueva. A tamaño real, no escala.
	const BLOCK_DROP = 0.2;
	const curvePath = asymptoteCurve as unknown as SVGPathElement;
	const smoothstep = (k: number) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));

	// Proyecciones de la punta a los ejes. El eje X del plano está en y=560 y el
	// eje Y en x=40 (viewBox). X_UNIT/Y_UNIT convierten unidades de viewBox a
	// los "números reales" que se muestran en cada eje.
	const AXIS_X_Y = 560;
	const AXIS_Y_X = 40;
	const X_UNIT = 46;
	const Y_UNIT = 24;
	// La etiqueta X se aparta a un lado (a la derecha de la línea vertical) y
	// por encima del eje; la Y se sube por encima de la línea horizontal.
	gsap.set(curveProjXLabel, { xPercent: 0, yPercent: -100 });
	gsap.set(curveProjYLabel, { xPercent: -100, yPercent: -100 });

	// y de la curva en x = FOLLOW_START_X (referencia para el follow vertical).
	let followStartY = 0;
	for (let i = 0; i <= 240; i++) {
		const pt = curvePath.getPointAtLength((curveLength * i) / 240);
		if (pt.x >= FOLLOW_START_X) {
			followStartY = pt.y;
			break;
		}
	}

	// Punta de la curva al final de la fase A (para seguirla sin salto en B).
	const headA0 = curvePath.getPointAtLength(curveLength * FRAC_A_END);

	let camAEndTx = 0;
	let camAEndTy = 0;
	let camBEndTx = 0;
	let camBEndTy = 0;

	const TRAVEL_START = BURST_POS + 2;
	const AB_DUR = 14; // duración (unidades de timeline) del tramo fases A+B
	const C_DUR = 12.5; // fase C: hasta aquí se dibuja la curva; después se congela y TODO gira

	// Proxy: fracción de curva dibujada. Un onUpdate común lo lee y reparte
	// cámara / dibujo según la fase. Nunca llega a 1 (FRAC_C_END) → siempre
	// queda curva por dibujar y la punta se sigue moviendo.
	const reveal = { drawn: 0 };

	const revealUpdate = () => {
		const frac = reveal.drawn;
		const revealedLen = curveLength * frac;
		gsap.set(asymptoteCurve, { strokeDashoffset: curveLength - revealedLen });
		const head = curvePath.getPointAtLength(revealedLen);
		const vw = window.innerWidth;
		const vh = window.innerHeight;
		let tx: number;
		let ty: number;
		if (frac <= FRAC_A_END) {
			// Fase A: la cámara engancha al pasar media pantalla y sigue la punta.
			const engage = smoothstep((head.x - FOLLOW_START_X) / FOLLOW_RAMP);
			tx = (FOLLOW_START_X - head.x) * engage;
			ty = (followStartY - head.y) * VERT_FOLLOW * engage;
			camAEndTx = tx;
			camAEndTy = ty;
			camBEndTx = tx;
			camBEndTy = ty;
		} else if (frac <= FRAC_B_END) {
			// Fase B: subida al espacio siguiendo la punta hacia arriba.
			tx = camAEndTx - (head.x - headA0.x);
			ty = camAEndTy - (head.y - headA0.y) * VERT_FOLLOW_B;
			camBEndTx = tx;
			camBEndTy = ty;
		} else {
			// Fase C: la cámara CLAVA la punta en un punto fijo de la pantalla
			// (arriba-izquierda). El extremo se ve siempre; la sensación de
			// crecimiento la da el trazo, que va fluyendo hacia abajo por debajo
			// de la punta a medida que "ascendemos". Se engancha desde la fase B
			// con un smoothstep corto para que no pegue tirón.
			const fc = (frac - FRAC_B_END) / (FRAC_C_END - FRAC_B_END);
			const k = smoothstep(Math.min(fc / C_TURN, 1));
			// La punta se queda CLAVADA en (TIP_SCREEN_X, TIP_SCREEN_Y) toda la
			// fase C. El tumbado de la línea NO se hace aquí: al final, el outro
			// rota #curve-tilt 90° a la vez que la sección Funciones.
			const targetTx = TIP_SCREEN_X - head.x;
			const targetTy = TIP_SCREEN_Y - head.y;
			tx = camBEndTx + (targetTx - camBEndTx) * k;
			ty = camBEndTy + (targetTy - camBEndTy) * k;
		}
		gsap.set(asymptoteDrift, { x: tx, y: ty });
		gsap.set(asymptoteCurveHead, { x: head.x, y: head.y });

		// Las letras matemáticas del fondo acompañan a la cámara con parallax.
		gsap.set(asymptoteGlyphLayer, {
			x: ((tx * vw) / 1000) * GLYPH_PARALLAX,
			y: ((ty * vh) / 600) * GLYPH_PARALLAX,
		});

		// Proyecciones a los ejes: solo en fase A (luego su grupo ya se apaga).
		if (frac <= FRAC_A_END) {
			gsap.set(curveProjX, { attr: { x1: head.x, y1: head.y, x2: head.x, y2: AXIS_X_Y } });
			gsap.set(curveProjY, { attr: { x1: head.x, y1: head.y, x2: AXIS_Y_X, y2: head.y } });

			const toScreenX = (vx: number) => ((vx + tx) * vw) / 1000;
			const toScreenY = (vy: number) => ((vy + ty) * vh) / 600;
			const clamp = gsap.utils.clamp;

			curveProjXLabel!.textContent = ((head.x - AXIS_Y_X) / X_UNIT).toFixed(1);
			gsap.set(curveProjXLabel, {
				x: clamp(24, vw - 44, toScreenX(head.x) + 9),
				y: clamp(20, vh - 6, toScreenY(AXIS_X_Y) - 6),
			});

			curveProjYLabel!.textContent = ((AXIS_X_Y - head.y) / Y_UNIT).toFixed(1);
			gsap.set(curveProjYLabel, {
				x: clamp(52, vw - 24, toScreenX(AXIS_Y_X) - 10),
				y: clamp(20, vh - 6, toScreenY(head.y) - 6),
			});
		}
	};

	tl.to(reveal, { drawn: FRAC_B_END + 0.02, duration: AB_DUR, ease: "none", onUpdate: revealUpdate }, TRAVEL_START)
		.to(reveal, { drawn: FRAC_C_END, duration: C_DUR, ease: "none", onUpdate: revealUpdate }, TRAVEL_START + AB_DUR)
		// El círculo de la punta y las proyecciones aparecen al arrancar el viaje
		// y se retiran antes de la subida al espacio.
		.to(asymptoteCurveHead, { opacity: 1, duration: 0.3, ease: "power1.out" }, TRAVEL_START)
		.to([curveProj, curveProjLabels], { opacity: 1, duration: 0.5, ease: "power1.out" }, TRAVEL_START + 0.4)
		.to([curveProj, curveProjLabels], { opacity: 0, duration: 0.6, ease: "power1.in" }, TRAVEL_START + 9);

	// Titulares en la esquina sup-izq mientras la función crece. Aparecen en
	// secuencia (primero "SP Agency, obra de ingeniería.", luego "Latencia
	// estudiada al milisegundo"), con un leve deslizamiento. Fondo gris opaco
	// (en el markup) para que la rejilla no se transparente por detrás.
	gsap.set([travelCaption1, travelCaption2], { y: 14, opacity: 0 });
	tl.to(travelCaption1, { opacity: 1, y: 0, duration: 0.8, ease: "power2.out" }, TRAVEL_START + 1)
		.to(travelCaption1, { opacity: 0, y: -14, duration: 0.7, ease: "power1.in" }, TRAVEL_START + 5)
		.to(travelCaption2, { opacity: 1, y: 0, duration: 0.8, ease: "power2.out" }, TRAVEL_START + 5.6)
		.to(travelCaption2, { opacity: 0, y: -14, duration: 0.9, ease: "power1.in" }, TRAVEL_START + 9.6);

	// ---- SALTO AL ESPACIO (fase B del viaje: la curva se dispara vertical) ----
	// El plano y las letras se apagan, el fondo gris pasa a negro, la curva vira
	// a blanco, la punta hace crossfade a estrellita y aparecen las estrellas.
	// (frac cruza FRAC_A_END ~a los 10s del tramo A+B.)
	const PHASE_B_START = TRAVEL_START + 10;
	// Se apaga SOLO la rejilla+ejes (#grid-lines) y las letras — la CURVA no,
	// que la función no desaparece nunca.
	tl.to([gridLines, asymptoteGlyphLayer], { opacity: 0, duration: 2, ease: "power1.in" }, PHASE_B_START)
		.to(spaceBg, { opacity: 1, duration: 2.2, ease: "power1.inOut" }, PHASE_B_START)
		.to(asymptoteCurve, { stroke: "#eeeeee", duration: 2.4, ease: "none" }, PHASE_B_START)
		.to(spaceStars, { opacity: 1, duration: 2.4, ease: "power1.out" }, PHASE_B_START + 0.5)
		.to(curveHeadDot, { opacity: 0, duration: 0.6, ease: "power1.in" }, PHASE_B_START + 0.6)
		.to(curveHeadStar, { opacity: 0.85, duration: 0.7, ease: "power1.out" }, PHASE_B_START + 0.6);

	// ---- FASE C: entra la sección FUNCIONES sobre el espacio ----
	// La exponencial sigue creciendo a la izquierda.
	//  1) entran los títulos centrados;
	//  2) al seguir scrolleando: el subtítulo se va y el título sube un poco;
	//  3) aparecen los 6 cards (rejilla centrada, oscuros/translúcidos, flotan);
	//  4) la luna cruza de arriba abajo, tenue → "seguimos subiendo".
	const SC = TRAVEL_START + AB_DUR; // arranque de la fase C
	const starRot = { v: 0 }; // proxy para rotar la estrellita de la punta
	gsap.set(spaceFeaturesHeading, { xPercent: -50, y: 26 });
	gsap.set(spaceFeaturesCards, { xPercent: -50, y: 40 });
	// La luna entra desde arriba-derecha y baja describiendo una diagonal
	// curvada (la X va con ease distinto a la Y) hasta salir abajo-izquierda.
	gsap.set(moon, {
		xPercent: -50,
		x: () => window.innerWidth * 0.15,
		y: () => -window.innerHeight * 0.55,
	});

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

	const OUTRO_LINE_AT = SC + C_DUR + 0.6; // instante en que arranca el dibujado de la asíntota nueva
	const OUTRO_LINE_DUR = 2.2;
	// Dibujado inicial de la asíntota: la punta (estrellita) avanza de -40vw a
	// 60vw (fracciones del ancho del viewport) con ease power2.out. Cruza el
	// centro de pantalla (50vw) cuando 1-(1-t)² = (0.5+0.4)/(0.6+0.4) = 0.9, o
	// sea t = 1-√0.1 ≈ 0.684. Ahí arranca la fase final.
	const OUTRO_TIP_START_X = -0.4;
	const OUTRO_TIP_REST_X = 0.6;
	const LINE_CENTER_AT =
		OUTRO_LINE_AT +
		OUTRO_LINE_DUR * (1 - Math.sqrt(1 - (0.5 - OUTRO_TIP_START_X) / (OUTRO_TIP_REST_X - OUTRO_TIP_START_X)));

	// Duración del cruce del agujero negro (arranca LINE_CENTER_AT + este
	// offset) y cuánto tarda en cruzar de lado a lado. El fondo de estrellas
	// (más abajo) deriva durante exactamente este mismo tramo, para no
	// quedarse parado mientras el agujero negro sigue en pantalla.
	const BLACKHOLE_START_OFFSET = 0.8;
	const BLACKHOLE_CROSS_DUR = 12.5;
	// El agujero negro recorre 2.1 anchos de viewport (de +1.05 a -1.05) en
	// BLACKHOLE_CROSS_DUR. El fondo tiene que viajar a esa MISMA velocidad
	// (no a la suya propia de antes) para que lea como una sola cámara
	// moviéndose — si no, uno adelanta al otro aunque los dos terminen a la
	// vez.
	const BLACKHOLE_SPEED = 2.1 / BLACKHOLE_CROSS_DUR;
	// El fondo, la asíntota y las tarjetas de la comunidad siguen a UNA cámara
	// (cameraAt, más abajo) hasta el FINAL de la escena — no solo mientras cruza
	// el agujero negro. OJO: el agujero negro NO forma parte de esa cámara: su
	// cruce es el guionizado arriba (mismo camino, tiempos y posición de
	// siempre) y la cámara no lo arrastra.
	const OUTRO_TAIL = 55; // de LINE_CENTER_AT al final de la escena
	const OUTRO_END = LINE_CENTER_AT + OUTRO_TAIL;
	// Debe coincidir con DEFAULT_YAW en BlackHole.astro — es desde donde arranca
	// el giro de cámara que anima el cruce (ver más abajo, tween de blackholeOrbit).
	const BLACKHOLE_DEFAULT_YAW = 2.94;
	const blackholeOrbit = { yaw: BLACKHOLE_DEFAULT_YAW };

	// ---- ACTO FINAL: la asíntota gira hacia abajo y llega la comunidad ----
	// Tiempos, en unidades de timeline (L = LINE_CENTER_AT):
	//   L+0.8 … L+13.3   el agujero negro cruza la pantalla (guionizado; su disco
	//                    sale del todo de pantalla hacia L+11.4)
	//   L+7 … L+16.4     EL GIRO: la asíntota pasa de ir hacia la derecha a ir
	//                    hacia abajo. Son dos giros sumados, cada uno con arranque
	//                    y final suaves (smoothstep sobre el rumbo):
	//                      · PRELUDIO (L+7 …): unos 9° en total, muy leves. Empieza
	//                        cuando el agujero negro pasa justo bajo la punta: un
	//                        primer tirón que enlaza la línea con él.
	//                      · GIRO PRINCIPAL (L+11.4 … L+16.4): los ~81° restantes,
	//                        cuando el agujero negro ya se ha ido. Más concentrado
	//                        (5 unidades) que un giro único, así que se nota más.
	//   L+14             aparece el encabezado de la comunidad
	//   L+16.4 …         suben los 9 testimonios, centrados; cada una crece un poco
	//                    al pasar por el centro de la pantalla y la última se asienta
	//                    centrada
	//   L+25.6           la última tarjeta llega al centro (SIEMPRE en este instante:
	//                    la velocidad vertical de la cámara se ajusta a la pantalla)
	//   L+25.75 … L+26.1  se desvanecen el encabezado y las tarjetas (rápido y lineal:
	//                    la última se lee un instante y se va)
	//   L+26.1 … L+27.7  la asíntota se desplaza al centro de la pantalla
	//   L+27.7 …         SEGUIMOS BAJANDO: la cámara ya no se detiene. Los pasos suben
	//                    desde abajo por el eje y la punta los toca en L+30.4 / L+34 /
	//                    L+37.6 (steps-act.ts); tras cada contacto el camino se va
	//                    completando hasta el siguiente.
	//   L+35 … L+37.2    ZOOM OUT de la cámara (a 0.78): asoma por abajo el agujero negro
	//   L+37.6           contacto del paso 3, el impacto más fuerte; empieza el retumbo
	//   L+39.2 … L+41    la cámara frena mientras el agujero negro sube al centro
	//   L+41 … L+43      plano quieto: el agujero negro en el centro, bajo la asíntota
	//   L+43 … L+49      INMERSIÓN: la cámara cae dentro del agujero negro (shader), la
	//                    asíntota y los pasos se apagan, el retumbo crece; negro total
	//                    hacia L+48.85
	//   L+49 … L+49.8    silencio en negro (el retumbo se corta)
	//   L+49.8 … L+52.7  un punto de luz reaparece, se expande y de él emerge la CTA
	//   L+55             fin de la escena (OUTRO_END): la CTA queda en pantalla y al
	//                    soltarse el pin se va con la escena; detrás llega el footer
	// La cámara SIGUE a la punta (se traslada, no gira): su velocidad es
	// BLACKHOLE_SPEED hacia la derecha y la que fija layoutOutro hacia abajo (ver
	// OUTRO_CARDS_REST_AT), con el rumbo que va tomando la asíntota. El fondo
	// (parallax 1) y las tarjetas son del mundo de esa cámara; la punta se queda
	// casi quieta en pantalla y solo se desplaza despacio de (60vw, línea) a
	// (75vw, 60vh) durante el giro para que el arco quede a la vista. La línea
	// se dibuja en coordenadas del mundo: es la estela que deja esa punta.
	const OUTRO_TURN_START = LINE_CENTER_AT + 7; // empieza el preludio
	const OUTRO_TURN_MAIN_START = LINE_CENTER_AT + 11.4; // empieza el giro principal
	const OUTRO_TURN_END = LINE_CENTER_AT + 16.4;
	const OUTRO_TURN_PRELUDE_DEG = 9;
	const COMMUNITY_HEADING_AT = LINE_CENTER_AT + 14;
	// Remate: con la última tarjeta ya centrada (a partir de ~L+25.6) la cámara
	// frena hasta pararse, el encabezado y las tarjetas se desvanecen para dar
	// paso a la sección siguiente, y una vez desaparecidos la asíntota se
	// desplaza al centro de la pantalla (toda entera, rígida: en ese punto lo
	// único visible de ella es un tramo vertical, así que no se deforma).
	// La última tarjeta llega SIEMPRE al centro en OUTRO_CARDS_REST_AT, sea cual
	// sea la pantalla: la velocidad vertical de la cámara tras el giro se calcula
	// en layoutOutro para que el recorrido que necesitan las tarjetas (depende
	// del alto y del tamaño de las tarjetas) dure justo eso. Si no, en pantallas
	// grandes llegaban mucho antes y se quedaban paradas hasta el desvanecido.
	const OUTRO_CARDS_REST_AT = LINE_CENTER_AT + 25.6;
	const COMMUNITY_HOLD = 0.15; // lo que se lee la última antes de irse
	const COMMUNITY_FADE_AT = OUTRO_CARDS_REST_AT + COMMUNITY_HOLD;
	const COMMUNITY_FADE_DUR = 0.35;
	const OUTRO_SETTLE_AT = COMMUNITY_FADE_AT + COMMUNITY_FADE_DUR;
	const OUTRO_SETTLE_DUR = 1.6;
	const OUTRO_TIP_CENTER_X = 0.5; // dónde acaba la punta (fracciones de W y H)
	const OUTRO_TIP_CENTER_Y = 0.5;
	const OUTRO_TIP_FINAL_X = 0.75; // fracciones de W y H donde queda la punta
	const OUTRO_TIP_FINAL_Y = 0.6;
	// Foco del carrusel: la tarjeta que pasa por el centro de la pantalla crece
	// (+CARD_FOCUS_SCALE) para dar la sensación de "esta es la que se lee" y
	// vuelve a su tamaño al superarlo. El radio de influencia es del orden de
	// una tarjeta (~ su alto), así que solo una a la vez está agrandada.
	const CARD_FOCUS_SCALE = 0.1;
	const CARD_FOCUS_RADIUS_VH = 0.2;

	// ---- PARTE B: zoom out, el agujero negro vuelve y se acerca ----
	// Al acercarse al tercer paso la cámara hace ZOOM OUT (todo el mundo escala
	// respecto al centro de la pantalla): asoma por abajo el agujero negro. Se
	// completa el paso 3 (el impacto más fuerte) y la cámara sigue bajando: el
	// agujero negro SUBE hasta quedar en el centro, justo bajo el extremo de la
	// asíntota, y la cámara frena y se para ahí (ese es el plano de partida de
	// la inmersión). Es el MISMO objeto que cruzó antes, ahora como cuerpo del
	// mundo: su posición sale de la cámara, no de un tween propio.
	const OUTRO_ZOOM_START = LINE_CENTER_AT + 35;
	const OUTRO_ZOOM_END = LINE_CENTER_AT + 37.2;
	const OUTRO_ZOOM_MIN = 0.78;
	const BH_BRAKE_START = LINE_CENTER_AT + 39.2; // la cámara empieza a frenar
	const BH_CENTER_AT = LINE_CENTER_AT + 41; // …y para: el agujero negro está en el centro
	// Retumbo: mientras el agujero negro está cerca, un temblor continuo y leve
	// de la cámara (en tiempo real; crece hasta RUMBLE_AMP px).
	const RUMBLE_START = LINE_CENTER_AT + 37.8;
	const RUMBLE_AMP = 3.2;

	// ---- PARTE C: inmersión en el agujero negro y salida a la CTA ----
	// Desde el plano quieto (agujero negro centrado) la cámara CAE dentro: no es
	// un zoom de CSS sino el propio shader (distancia de cámara de 30 a ~3 y
	// ángulo hacia arriba, cayendo sobre el disco), así que la lente
	// gravitacional se dispara de verdad. Acelera (power2.in) y termina en negro.
	// Lo demás (asíntota, pasos) se apaga; el retumbo crece y se corta en seco al
	// llegar al negro. Tras un silencio de negro reaparece un punto de luz — la
	// estrella de la punta —, se expande y de él emerge la CTA (SceneCta.astro).
	const DIVE_START = LINE_CENTER_AT + 43;
	const DIVE_DUR = 6;
	const DIVE_END = DIVE_START + DIVE_DUR;
	const DIVE_DIST_FAR = 30; // = DEFAULT_DIST de BlackHole.astro (punto de partida)
	const DIVE_DIST_NEAR = 3.2; // dentro del disco: la sombra ocupa todo el canvas
	const DIVE_PITCH_START = -0.004; // = DEFAULT_PITCH de BlackHole.astro
	const DIVE_PITCH_END = 0.6; // rad: se mira desde arriba, cayendo sobre el disco
	const DIVE_BH_SCALE_END = 1.9; // el canvas (1400px) crece hasta cubrir cualquier pantalla
	const DIVE_BLACK_AT = DIVE_END - 0.9; // empieza el negro total…
	const DIVE_BLACK_DONE = DIVE_END - 0.15; // …y es total aquí
	const DIVE_RUMBLE_AMP = 8; // el retumbo sube hasta esto durante la caída
	const SPARK_AT = LINE_CENTER_AT + 49.8; // el punto de luz reaparece
	const BLOOM_AT = LINE_CENTER_AT + 50.5; // …y se expande
	const BLOOM_DUR = 2;
	const CTA_AT = LINE_CENTER_AT + 51.5; // de él emerge la CTA
	const CTA_DUR = 1.2;

	const smoothstep01 = (k: number) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));

	// Rumbo de la asíntota (y de la cámara que la sigue) en radianes: 0 = hacia
	// la derecha, 90° = hacia abajo. Suma del preludio leve y del giro principal;
	// los dos son smoothstep, así que la suma tiene arranque y final suaves y
	// llega a 90° exactos en OUTRO_TURN_END.
	const headingAt = (t: number) => {
		const prelude =
			OUTRO_TURN_PRELUDE_DEG * smoothstep01((t - OUTRO_TURN_START) / (OUTRO_TURN_END - OUTRO_TURN_START));
		const main =
			(90 - OUTRO_TURN_PRELUDE_DEG) * smoothstep01((t - OUTRO_TURN_MAIN_START) / (OUTRO_TURN_END - OUTRO_TURN_MAIN_START));
		return ((prelude + main) * Math.PI) / 180;
	};

	// Cámara: integral de (cos θ, sin θ) con θ = headingAt (el giro de arriba),
	// tabulada UNA vez en unidades de "velocidad × tiempo" (independiente del
	// viewport); cameraAt la interpola y la escala por la velocidad en px.
	// La velocidad pasa de 1 (rumbo derecha, la del agujero negro) a `r` (rumbo
	// abajo) al ritmo del rumbo; r la fija layoutOutro según la pantalla.
	const CAM_DT = 0.05;
	const CAM_STEPS = Math.ceil((OUTRO_END - LINE_CENTER_AT) / CAM_DT) + 1;
	const camNormX = new Float64Array(CAM_STEPS);
	const camNormY = new Float64Array(CAM_STEPS);
	const buildCamera = (r: number) => {
		for (let i = 1; i < CAM_STEPS; i++) {
			const tMid = LINE_CENTER_AT + (i - 0.5) * CAM_DT;
			const theta = headingAt(tMid);
			const blend = 1 + (r - 1) * (theta / (Math.PI / 2));
			// Velocidad constante… salvo el "hit-stop" de cada contacto de los pasos: la
			// cámara se frena un instante para dar peso al impacto (steps-act.ts).
			// Y frena hasta pararse cuando el agujero negro llega al centro (parte B).
			const brake = 1 - smoothstep01((tMid - BH_BRAKE_START) / (BH_CENTER_AT - BH_BRAKE_START));
			const speed = blend * hitStopFactor(tMid - LINE_CENTER_AT) * brake;
			camNormX[i] = camNormX[i - 1] + Math.cos(theta) * CAM_DT * speed;
			camNormY[i] = camNormY[i - 1] + Math.sin(theta) * CAM_DT * speed;
		}
	};
	const cameraAt = (t: number) => {
		const u = (t - LINE_CENTER_AT) / CAM_DT;
		if (u <= 0) return { x: 0, y: 0 };
		const i = Math.min(Math.floor(u), CAM_STEPS - 2);
		const f = Math.min(u - i, 1);
		const speed = window.innerWidth * BLACKHOLE_SPEED;
		return {
			x: (camNormX[i] + (camNormX[i + 1] - camNormX[i]) * f) * speed,
			y: (camNormY[i] + (camNormY[i + 1] - camNormY[i]) * f) * speed,
		};
	};

	// Posición de la punta EN PANTALLA: el dibujado inicial (de -40vw a 60vw,
	// power2.out) y, durante el giro, el desplazamiento lento a su sitio final.
	const tipScreenAt = (t: number) => {
		const W = window.innerWidth;
		const H = window.innerHeight;
		// El centro del trazo coincide con el de la barra que había antes
		// (top:10% + la mitad de su grosor de 0.3vw).
		const lineY = H * 0.1 + W * 0.0015;
		// La punta se desplaza en pantalla al mismo ritmo que gira el rumbo.
		const e = headingAt(t) / (Math.PI / 2);
		let fx: number;
		if (t < OUTRO_LINE_AT + OUTRO_LINE_DUR) {
			const k = Math.min(Math.max((t - OUTRO_LINE_AT) / OUTRO_LINE_DUR, 0), 1);
			fx = OUTRO_TIP_START_X + (OUTRO_TIP_REST_X - OUTRO_TIP_START_X) * (1 - (1 - k) * (1 - k));
		} else {
			fx = OUTRO_TIP_REST_X + (OUTRO_TIP_FINAL_X - OUTRO_TIP_REST_X) * e;
		}
		return { x: W * fx, y: lineY + (H * OUTRO_TIP_FINAL_Y - lineY) * e };
	};

	// Estela: la punta en coordenadas del MUNDO (cámara + posición en pantalla),
	// muestreada en el tiempo y guardada como polilínea; con la longitud
	// acumulada se revela con stroke-dashoffset hasta donde va la punta.
	const OUTRO_PATH_DT = 0.05;
	const outroPathEl = outroPath!;
	const outroGeo = {
		prepend: 0,
		total: 0,
		cum: new Float64Array(0),
		winTop: 0,
		winH: 0,
		cardsTurnEndY: 0,
		cardEls: [] as HTMLElement[],
		cardMids: new Float64Array(0), // centro de cada tarjeta dentro de la pista
		lastMid: 0,
		bhWorldX: 0, // posición del agujero negro en el mundo (parte B)
		bhWorldY: 0,
	};
	const outroClock = { t: OUTRO_LINE_AT };
	// Fondo estelar infinito: lo dibuja un canvas a partir de la cámara (y del
	// estado de opacidad/bajada que ya animan los tweens sobre #space-stars).
	const starField = createStarField(spaceStarsCanvas!, spaceStars!);
	const outroWorldEl = outroWorld!;
	const routeDotsEl = routeDots!;
	const routeGradEl = routeGrad!;
	const outroLineEl = outroLine!;
	const outroStarLayerEl = outroStarLayer!;
	const stepsWorldEl = stepsWorld!;
	const diveVignetteEl = diveVignette!;
	const diveBlackEl = diveBlack!;
	const ctaSceneEl = ctaScene!;
	const ctaLinks = [...ctaSceneEl.querySelectorAll<HTMLAnchorElement>("a")];
	const ctaScrim = document.getElementById("cta-scene-scrim");
	const ctaWords = [...ctaSceneEl.querySelectorAll<HTMLElement>("[data-cta-word]")];
	const ctaSub = ctaSceneEl.querySelector<HTMLElement>("[data-cta-sub]");
	const ctaButtons = ctaSceneEl.querySelector<HTMLElement>("[data-cta-buttons]");
	const ctaRecapItems = [...ctaSceneEl.querySelectorAll<HTMLElement>("[data-cta-recap-item]")];
	const ctaRecapLines = [...ctaSceneEl.querySelectorAll<HTMLElement>("[data-cta-recap-line]")];
	const ctaRings = [...ctaSceneEl.querySelectorAll<SVGCircleElement>("[data-cta-ring]")];
	const ctaChecks = [...ctaSceneEl.querySelectorAll<SVGPathElement>("[data-cta-check]")];
	const RING_LEN = 62.83;
	// Rebote de salida del botón principal (easeOutBack).
	const outBack = (k: number) => {
		const c1 = 1.9;
		const c3 = c1 + 1;
		return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2);
	};
	// La CTA se compone por piezas, cada una con su retardo (en unidades del
	// timeline desde CTA_AT): título palabra a palabra, texto, botones, recap.
	// (Arranca en true para que el primer render deje todas las piezas ocultas.)
	let ctaAnimated = true;
	const renderCta = (ctaT: number) => {
		if (ctaT <= 0 && !ctaAnimated) return;
		ctaAnimated = ctaT > 0;
		const at = (delay: number, dur: number) => smoothstep01((ctaT - delay) / dur);
		ctaWords.forEach((w, i) => {
			const p = at(i * 0.11, 0.75);
			gsap.set(w, { opacity: p, y: (1 - p) * 26, filter: p < 1 ? `blur(${(1 - p) * 12}px)` : "none" });
		});
		const subP = at(0.85, 0.7);
		if (ctaSub) gsap.set(ctaSub, { opacity: subP, y: (1 - subP) * 16 });
		const btnRaw = Math.min(Math.max((ctaT - 1.1) / 0.8, 0), 1);
		if (ctaButtons) {
			gsap.set(ctaButtons, {
				opacity: smoothstep01(btnRaw * 1.6),
				y: (1 - outBack(btnRaw)) * 34,
				scale: btnRaw === 0 ? 0.92 : 0.92 + 0.08 * outBack(btnRaw),
			});
		}
		ctaRecapItems.forEach((el, i) => {
			const p = at(1.6 + i * 0.25, 0.6);
			gsap.set(el, { opacity: p, y: (1 - p) * 12 });
			const ring = at(1.75 + i * 0.25, 0.7);
			ctaRings[i]?.setAttribute("stroke-dashoffset", String(RING_LEN * (1 - ring)));
			ctaChecks[i]?.setAttribute("opacity", String(smoothstep01((ring - 0.7) / 0.3)));
		});
		ctaRecapLines.forEach((el, i) => {
			gsap.set(el, { opacity: at(1.9 + i * 0.25, 0.3), scaleX: at(1.9 + i * 0.25, 0.5) });
		});
		return btnRaw;
	};
	// Envía al shader del agujero negro la distancia y el ángulo de la caída (solo
	// si cambian: renderOutro se llama cada frame).
	const lastDive = { dist: Number.NaN, pitch: Number.NaN };
	const sendDive = (dist: number, pitch: number) => {
		if (Math.abs(dist - lastDive.dist) < 1e-4 && Math.abs(pitch - lastDive.pitch) < 1e-5) return;
		lastDive.dist = dist;
		lastDive.pitch = pitch;
		outroBlackholeCanvas?.dispatchEvent(new CustomEvent("blackhole:orbit", { detail: { dist, pitch } }));
	};
	// Los pasos: nodos del camino en coordenadas del mundo (steps-act.ts). Sus
	// efectos son en tiempo real; requestRender re-pinta la escena en el instante
	// actual cuando lo que cambia no es el scroll sino el shake o la estrella.
	const stepsAct = createStepsAct(stepNodes, () => renderOutro(outroClock.t));

	// Zoom de la cámara: 1 hasta OUTRO_ZOOM_START y de ahí, suave, hasta el
	// zoom out (OUTRO_ZOOM_MIN), donde se queda para la inmersión.
	const zoomAt = (t: number) =>
		1 + (OUTRO_ZOOM_MIN - 1) * smoothstep01((t - OUTRO_ZOOM_START) / (OUTRO_ZOOM_END - OUTRO_ZOOM_START));

	// Retumbo del agujero negro: temblor CONTINUO y leve (en tiempo real, no atado
	// al scroll) cuyo volumen crece desde RUMBLE_START hasta que el agujero negro
	// llega al centro. Ruido determinista sobre el reloj → mismo carácter siempre.
	// Avance de la caída (0 → 1) y su versión acelerada (power2.in: cae cada vez
	// más rápido). El retumbo sube hasta DIVE_RUMBLE_AMP durante la caída y se
	// CORTA en seco justo antes del negro total: el silencio es parte del efecto.
	const diveU = (t: number) => Math.min(Math.max((t - DIVE_START) / DIVE_DUR, 0), 1);
	const diveK = (t: number) => diveU(t) ** 2;
	const rumbleAt = (t: number) => {
		const k = smoothstep01((t - RUMBLE_START) / (BH_CENTER_AT - RUMBLE_START));
		if (k <= 0) return { x: 0, y: 0 };
		const cut = 1 - smoothstep01((t - (DIVE_END - 0.4)) / 0.3);
		const amp = (RUMBLE_AMP * k + (DIVE_RUMBLE_AMP - RUMBLE_AMP) * diveK(t)) * cut;
		if (amp <= 0) return { x: 0, y: 0 };
		const now = performance.now() / 1000;
		return { x: amp * wobble(now, 3.1), y: amp * 0.8 * wobble(now, 8.3) };
	};

	const renderOutro = (t: number) => {
		const g = outroGeo;
		const W = window.innerWidth;
		const H = window.innerHeight;
		const rawCam = cameraAt(t);
		// Shake de cámara de los impactos y retumbo del agujero negro: se suman a la
		// cámara para que tiemble TODO el mundo (fondo, línea, nodos) a la vez.
		const rumble = rumbleAt(t);
		const shakeX = stepsAct.shake.x + rumble.x;
		const shakeY = stepsAct.shake.y + rumble.y;
		const cam = { x: rawCam.x + shakeX, y: rawCam.y + shakeY };
		const tip = tipScreenAt(t);
		// Zoom de la cámara respecto al centro de la pantalla (c): mundo → pantalla
		// es  c + (mundo − cámara + settle − c) · zoom.
		const z = zoomAt(t);
		const cx = W / 2;
		const cy = H / 2;

		const u = Math.min(Math.max((t - OUTRO_LINE_AT) / OUTRO_PATH_DT, 0), g.cum.length - 1);
		const i = Math.min(Math.floor(u), g.cum.length - 2);
		const revealed = g.prepend + g.cum[i] + (g.cum[i + 1] - g.cum[i]) * (u - i);
		// Remate: la asíntota entera (trazo y punta, en bloque) se desplaza del sitio
		// donde cayó al centro de la pantalla.
		const settle = smoothstep01((t - OUTRO_SETTLE_AT) / OUTRO_SETTLE_DUR);
		const dx = (OUTRO_TIP_CENTER_X - OUTRO_TIP_FINAL_X) * W * settle;
		const dy = (OUTRO_TIP_CENTER_Y - OUTRO_TIP_FINAL_Y) * H * settle;
		outroPathEl.style.strokeDashoffset = `${g.total - revealed}`;
		outroWorldEl.setAttribute(
			"transform",
			`translate(${cx} ${cy}) scale(${z}) translate(${-cam.x + dx - cx} ${-cam.y + dy - cy})`,
		);

		// La estrellita va en el extremo dibujado del trazo (con el shake ya
		// aplicado al trazo, hay que restarlo aquí). Al tocar el primer paso se
		// absorbe dentro del aro: baja hasta su centro mientras se encoge y se apaga.
		const absorb = stepsAct.starAbsorb.k;
		gsap.set(outroLineStar, {
			x: cx + (tip.x + dx - shakeX - cx) * z,
			y: cy + (tip.y + dy - shakeY - cy) * z + STEP_RADIUS * absorb * z,
			scale: z * (1 - 0.85 * absorb),
			opacity: 1 - absorb,
		});

		starField.setCamera(cam.x, cam.y, z);

		// Pasos: nodos del mundo; su estado "completado" es función del tiempo.
		stepsAct.setTime(t - LINE_CENTER_AT);
		stepsAct.render({ W, H, camX: cam.x, camY: cam.y, dx, dy, zoom: z, cx, cy });

		// Agujero negro. Primero su cruce guionizado de siempre (misma fórmula que
		// tenían sus tweens: entra por la derecha con el centro en el borde
		// inferior y sale por la izquierda). Después, ya como cuerpo del mundo,
		// vuelve por debajo: su posición sale de la cámara y del zoom, así que
		// asoma con el zoom out y sube hasta el centro al seguir bajando la cámara.
		const bhStart = LINE_CENTER_AT + BLACKHOLE_START_OFFSET;
		let bhX: number;
		let bhY: number;
		let bhScale = 1;
		let bhOpacity = 1;
		if (t < bhStart + BLACKHOLE_CROSS_DUR) {
			const p = Math.min(Math.max((t - bhStart) / BLACKHOLE_CROSS_DUR, 0), 1);
			const fade = Math.min(Math.max((t - bhStart) / 1.8, 0), 1);
			bhX = W * (1.05 - 2.1 * p);
			bhY = H * 0.5;
			bhOpacity = 1 - (1 - fade) * (1 - fade);
		} else {
			bhX = cx + (g.bhWorldX - cam.x + dx - cx) * z - cx;
			bhY = cy + (g.bhWorldY - cam.y + dy - cy) * z - cy;
			// El zoom out (0.78) y, en la caída, el crecimiento hasta cubrir la pantalla.
			bhScale = z + (DIVE_BH_SCALE_END - z) * diveK(t);
		}
		gsap.set(outroBlackhole, { x: bhX, y: bhY, scale: bhScale, opacity: bhOpacity });

		// ---- Parte C: inmersión y salida a la CTA ----
		const diveProgress = diveU(t);
		const kDive = diveK(t);
		// El agujero negro crece hasta cubrir la pantalla y su shader CAE: la
		// distancia de cámara baja en geométrica (zoom constante en log) y el
		// ángulo sube, mirando cada vez más desde arriba al disco.
		sendDive(
			DIVE_DIST_FAR * Math.pow(DIVE_DIST_NEAR / DIVE_DIST_FAR, kDive),
			DIVE_PITCH_START + (DIVE_PITCH_END - DIVE_PITCH_START) * kDive,
		);

		// La asíntota y los pasos se apagan al empezar la caída. (El fundido de
		// entrada del trazo, que antes era un tween, también sale de aquí: así
		// una sola función es dueña de esas opacidades.)
		const lineIn = Math.min(Math.max((t - OUTRO_LINE_AT) / 0.35, 0), 1);
		const diveFade = smoothstep01((diveProgress - 0.05) / 0.4);
		outroLineEl.style.opacity = String(lineIn * (1 - diveFade));
		outroStarLayerEl.style.opacity = String(lineIn * (1 - diveFade));
		stepsWorldEl.style.opacity = String(1 - diveFade);

		// Viñeta que se cierra y negro total al llegar dentro.
		diveVignetteEl.style.opacity = String(0.7 * smoothstep01((diveProgress - 0.35) / 0.6));
		diveBlackEl.style.opacity = String(smoothstep01((t - DIVE_BLACK_AT) / (DIVE_BLACK_DONE - DIVE_BLACK_AT)));

		// Del negro: punto de luz → expansión → CTA. El punto se apaga dentro del
		// resplandor que crece; el resplandor cede y deja la tarjeta.
		const sparkIn = smoothstep01((t - SPARK_AT) / 0.5);
		const bloomK = smoothstep01((t - BLOOM_AT) / BLOOM_DUR);
		const ctaP = smoothstep01((t - CTA_AT) / CTA_DUR);
		gsap.set(diveSpark, {
			opacity: sparkIn * (1 - smoothstep01((t - BLOOM_AT - 0.3) / 0.8)),
			scale: 1 + 0.6 * bloomK,
		});
		gsap.set(diveBloom, {
			opacity: smoothstep01((t - BLOOM_AT + 0.3) / 0.6) * (1 - 0.7 * ctaP),
			scale: 1 + 40 * bloomK,
		});
		if (ctaScrim) ctaScrim.style.opacity = String(ctaP);
		const btnProgress = renderCta(t - CTA_AT) ?? 0;
		const ctaLive = btnProgress > 0.6;
		ctaSceneEl.style.opacity = "1";
		ctaSceneEl.style.pointerEvents = ctaLive ? "auto" : "none";
		for (const a of ctaLinks) a.tabIndex = ctaLive ? 0 : -1;

		// Tarjetas: son del mundo, así que suben lo que baja la cámara desde que
		// acaba el giro (a la misma velocidad que el fondo). La pista arranca justo
		// debajo de la ventana y se asienta con la última tarjeta CENTRADA en la
		// pantalla (así todas, la última incluida, pasan por el centro y ganan foco).
		const yRest = H * 0.5 - g.winTop - g.lastMid;
		const travelled = Math.max(0, cam.y - g.cardsTurnEndY);
		const trackY = Math.max(yRest, g.winH - travelled);
		gsap.set(communityTrack, { y: trackY });

		// Foco: escala según lo cerca que está el centro de cada tarjeta del centro
		// de la pantalla (0 → tamaño normal, 1 → agrandada), suavizado.
		const radius = H * CARD_FOCUS_RADIUS_VH;
		for (let c = 0; c < g.cardEls.length; c++) {
			const d = Math.abs(g.winTop + trackY + g.cardMids[c] - H * 0.5) / radius;
			const b = smoothstep01(1 - d);
			g.cardEls[c].style.transform = b > 0 ? `scale(${1 + CARD_FOCUS_SCALE * b})` : "";
		}
	};

	const layoutOutro = () => {
		const g = outroGeo;
		const W = window.innerWidth;
		const H = window.innerHeight;

		// 1) Medidas de las tarjetas.
		g.winTop = communityWindow!.offsetTop;
		g.winH = communityWindow!.offsetHeight;
		g.cardEls = Array.from(communityTrack!.children) as HTMLElement[];
		g.cardMids = Float64Array.from(g.cardEls, (el) => el.offsetTop + el.offsetHeight / 2);
		g.lastMid = g.cardMids[g.cardMids.length - 1];

		// 2) Velocidad vertical de la cámara tras el giro: la que hace que la
		// pista recorra lo que necesita (hasta centrar la última tarjeta) justo
		// entre OUTRO_TURN_END y OUTRO_CARDS_REST_AT. r es su cociente con la
		// velocidad horizontal (la del agujero negro); ~1 en 1280×800.
		const needed = g.winH - (H * 0.5 - g.winTop - g.lastMid);
		const vDown = Math.max(needed, 1) / (OUTRO_CARDS_REST_AT - OUTRO_TURN_END);
		const r = Math.min(Math.max(vDown / (W * BLACKHOLE_SPEED), 0.6), 1.5);
		buildCamera(r);
		g.cardsTurnEndY = cameraAt(OUTRO_TURN_END).y;

		// 3) La estela.
		const n = Math.ceil((OUTRO_END - OUTRO_LINE_AT) / OUTRO_PATH_DT) + 1;
		const cum = new Float64Array(n);
		const segs: string[] = [];
		let prevX = 0;
		let prevY = 0;
		for (let i = 0; i < n; i++) {
			const t = Math.min(OUTRO_LINE_AT + i * OUTRO_PATH_DT, OUTRO_END);
			const cam = cameraAt(t);
			const tip = tipScreenAt(t);
			const px = cam.x + tip.x;
			const py = cam.y + tip.y;
			if (i === 0) {
				// Empieza mucho más a la izquierda de la pantalla: el extremo nunca entra en cuadro.
				segs.push(`M ${px - 2.5 * W} ${py} L ${px} ${py}`);
			} else {
				cum[i] = cum[i - 1] + Math.hypot(px - prevX, py - prevY);
				segs.push(`L ${px} ${py}`);
			}
			prevX = px;
			prevY = py;
		}
		g.prepend = 2.5 * W;
		g.cum = cum;
		g.total = g.prepend + cum[n - 1];
		outroPathEl.setAttribute("d", segs.join(" "));
		outroPathEl.setAttribute("stroke-width", String(W * 0.003));
		outroPathEl.style.strokeDasharray = `${g.total}`;

		// 4) Los pasos sobre el eje de la asíntota, y el camino punteado que los
		// une. El eje es la vertical por la que cae la punta (tras el giro la
		// cámara ya no se mueve en x); cada paso queda a la altura donde su aro
		// toca la punta en su instante de contacto. El degradado blanco→azul del
		// trazo cambia justo en el primer paso.
		const axisWorldX = cameraAt(OUTRO_TURN_END).x + OUTRO_TIP_FINAL_X * W;
		stepsAct.layout(
			axisWorldX,
			(k) => cameraAt(LINE_CENTER_AT + STEP_CONTACT_OFFSETS[k]).y + H * OUTRO_TIP_FINAL_Y + STEP_RADIUS,
		);
		// El agujero negro (parte B) está en el mismo eje, a la altura a la que la
		// punta llega cuando la cámara frena en BH_CENTER_AT: queda EXACTAMENTE bajo
		// el extremo de la asíntota. El camino punteado sigue hasta él.
		g.bhWorldX = axisWorldX;
		g.bhWorldY = cameraAt(BH_CENTER_AT).y + H * OUTRO_TIP_FINAL_Y;
		const firstY = stepsAct.worldY(0);
		routeDotsEl.setAttribute("d", `M ${axisWorldX} ${firstY} L ${axisWorldX} ${g.bhWorldY}`);
		routeGradEl.setAttribute("y1", String(firstY));
		routeGradEl.setAttribute("y2", String(firstY + 1));

		renderOutro(outroClock.t);
	};
	gsap.set(outroLineStar, { xPercent: -50, yPercent: -50 });
	layoutOutro();
	window.addEventListener("resize", layoutOutro);

	tl
		// 1) títulos
		.to(spaceFeatures, { opacity: 1, duration: 1, ease: "none" }, SC)
		.to(spaceFeaturesHeading, { opacity: 1, y: 0, duration: 1.2, ease: "power2.out" }, SC + 0.5)
		// 2) el subtítulo se va y el título sube para dejar hueco
		.to(spaceFeaturesSub, { opacity: 0, duration: 0.8, ease: "power1.in" }, SC + 3.6)
		.to(spaceFeaturesHeading, { y: -130, duration: 1.3, ease: "power2.inOut" }, SC + 3.8)
		// 3) los cards entran (el flotar suave lo hace el CSS de cada card)
		.to(spaceFeaturesCards, { opacity: 1, y: 0, duration: 1.1, ease: "power2.out" }, SC + 4.3)
		// 4) la luna cruza en diagonal curvada, muy tenue (lejana) → sensación de
		//    seguir ascendiendo. La Y baja a ritmo constante (scroll-locked) y la
		//    X deriva con otro ease, así la trayectoria no es una recta.
		.to(moon, { opacity: 0.16, duration: 1.4, ease: "power1.out" }, SC + 3.4)
		.to(moon, { y: () => window.innerHeight * 1.15, duration: 7.5, ease: "none" }, SC + 3.4)
		// Las estrellas de fondo también bajan (parallax: bastante menos que la
		// luna) → refuerza la sensación de que seguimos ascendiendo. FRENAN de
		// forma gradual (power2.out, no "none") en vez de parar en seco, justo
		// sobre cuando la asíntota antigua empieza a desaparecer (SC + 10).
		.to(spaceStars, { y: () => window.innerHeight * 0.368, duration: 7.4, ease: "power2.out" }, SC + 3.4)
		.to(
			moon,
			{ x: () => -window.innerWidth * 0.1, duration: 7.5, ease: "sine.inOut" },
			SC + 3.4,
		)
		// La luna se apaga del todo mientras sale por abajo → antes del giro ya
		// no está.
		.to(moon, { opacity: 0, duration: 2, ease: "power1.in" }, SC + 8.9)
		// Mientras la luna está en pantalla, la estrellita de la punta gira un
		// poco → no se ve clavada. Se rota con el atributo SVG `transform`
		// (`rotate(n)` sin centro = gira sobre el (0,0) local, que es justo el
		// centro de la estrella) para que NO se desplace — con la propiedad
		// `rotation` de GSAP el transformOrigin caía descentrado.
		.to(
			starRot,
			{
				v: 75,
				duration: 7.5,
				ease: "sine.inOut",
				onUpdate: () => curveHeadStar!.setAttribute("transform", `rotate(${starRot.v})`),
			},
			SC + 3.4,
		)
		// 5) EL GIRO. Terminada la fase C, el título y las cards giran JUNTOS,
		//    como un bloque (rota #space-features entero), A TAMAÑO REAL — no se
		//    reescala. Solo BAJA un poco (BLOCK_DROP) para dejar hueco a la
		//    asíntota nueva; que sobresalga por abajo es aceptable.
		.to(
			spaceFeatures,
			{
				rotation: CARDS_SPIN,
				y: () => window.innerHeight * BLOCK_DROP,
				duration: 3.4,
				ease: "power2.inOut",
			},
			SC + C_DUR,
		)
		// La curva del plano (dentro del SVG deformado por preserveAspectRatio)
		// no rota bien, así que se MARCHA hacia abajo — y lo hace un poco antes
		// del giro: justo cuando la luna, ya pasada, está a punto de esconderse.
		.to(curveTilt, { y: 900, opacity: 0, duration: 2.2, ease: "power2.in" }, SC + 10)
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
		)
		// 6) LA CÁMARA SE DESPLAZA DE LADO. En cuanto la punta de la asíntota
		//    nueva pasa por el centro de la pantalla: el título y las cards —ya
		//    sin protagonismo— se van hacia la izquierda hasta salir de cuadro;
		//    la asíntota se queda (es lo único que "sigue creciendo"); y el
		//    fondo de estrellas deriva hacia la izquierda para vender que
		//    seguimos moviéndonos, ahora de lado en vez de hacia arriba.
		.to(spaceFeatures, { x: () => -window.innerWidth * 1.3, duration: 2.4, ease: "power1.in" }, LINE_CENTER_AT)
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

	// Solo en desarrollo (Vite lo elimina del build): expone el timeline para
	// poder inspeccionar la escena por consola — tl.scrollTrigger.disable(false)
	// y tl.time(t) sitúan la escena en cualquier instante sin scrollear.
	if (import.meta.env.DEV) (window as unknown as { __introTl?: gsap.core.Timeline }).__introTl = tl;

	// El retumbo del agujero negro es en tiempo real: mientras la escena esté
	// pinada y el tiempo haya pasado de RUMBLE_START, se repinta cada frame aunque
	// el usuario no scrollee (si no, temblaría solo al mover el scroll).
	gsap.ticker.add(() => {
		if (outroClock.t < RUMBLE_START || !tl.scrollTrigger?.isActive) return;
		renderOutro(outroClock.t);
	});

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
	if (Math.abs(tl.duration() - TL_UNITS) > 0.05) {
		console.warn(
			`intro-scene: la duración real del timeline (${tl.duration().toFixed(2)}) no coincide con TL_UNITS (${TL_UNITS}); ajusta TL_UNITS o el ritmo del pin saldrá distinto.`,
		);
	}

	// (La sección <Features/> normal se quitó del index: "Funciones" vive ahora
	// dentro de esta escena, en la fase C.)
} else {
	// Sin animación (accesibilidad, o si algo no cargó): mostrar el estado
	// final directamente.
	setFinalStatValues();

	// Sin escena animada no hay carrusel de la comunidad: se muestra la sección
	// estática de respaldo (ya accesible por sí misma) y se retira la versión
	// solo-lectores para no duplicar el contenido.
	document.getElementById("testimonials-static")?.classList.remove("hidden");
	document.getElementById("testimonials-a11y")?.setAttribute("hidden", "");

	// Igual con los tres pasos: sección estática de respaldo en lugar del camino.
	document.getElementById("how-static")?.classList.remove("hidden");
	document.getElementById("steps-a11y")?.setAttribute("hidden", "");

	// Y con la CTA: la estática en lugar de la que emerge del agujero negro.
	document.getElementById("cta-static")?.classList.remove("hidden");
	document.getElementById("cta-scene")?.setAttribute("hidden", "");
}
