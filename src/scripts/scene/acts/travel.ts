// El viaje de la curva por el plano, los titulares y el salto al espacio.
import { gsap } from "gsap";
import type { SceneRefs } from "../dom";
import type { Measurements } from "../prepare";
import { TRAVEL_START, AB_DUR, C_DUR } from "../timing";

export function addTravelAct(tl: gsap.core.Timeline, r: SceneRefs, m: Measurements) {
	const {
		gridLines,
		asymptoteDrift,
		asymptoteCurve,
		asymptoteCurveHead,
		curveHeadDot,
		curveHeadStar,
		spaceBg,
		spaceStars,
		curveProj,
		curveProjX,
		curveProjY,
		curveProjLabels,
		curveProjXLabel,
		curveProjYLabel,
		asymptoteGlyphLayer,
		travelCaption1,
		travelCaption2,
	} = r;
	const { curveLength } = m;
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
}
