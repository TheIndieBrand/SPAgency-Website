// Fase C: la sección "Funciones" sobre el espacio, la luna y el giro del bloque.
import { gsap } from "gsap";
import type { SceneRefs } from "../dom";
import { C_DUR, SC, LINE_CENTER_AT } from "../timing";

// Giro del outro para la sección Funciones (grados). Signo = sentido.
const CARDS_SPIN = 90;
// Cuánto BAJA el bloque título+cards ya girado (fracción del alto de
// viewport), para dejar hueco a la asíntota nueva. A tamaño real, no escala.
const BLOCK_DROP = 0.2;

export function setupFeatures(r: SceneRefs) {
	const { moon, spaceFeaturesHeading, spaceFeaturesCards } = r;
	// ---- FASE C: entra la sección FUNCIONES sobre el espacio ----
	// La exponencial sigue creciendo a la izquierda.
	//  1) entran los títulos centrados;
	//  2) al seguir scrolleando: el subtítulo se va y el título sube un poco;
	//  3) aparecen los 6 cards (rejilla centrada, oscuros/translúcidos, flotan);
	//  4) la luna cruza de arriba abajo, tenue → "seguimos subiendo".
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
	return { starRot };
}

export function addFeaturesAct(tl: gsap.core.Timeline, r: SceneRefs, starRot: { v: number }) {
	const {
		curveTilt,
		curveHeadStar,
		spaceStars,
		spaceFeatures,
		moon,
		spaceFeaturesHeading,
		spaceFeaturesSub,
		spaceFeaturesCards,
	} = r;
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
		.to(curveTilt, { y: 900, opacity: 0, duration: 2.2, ease: "power2.in" }, SC + 10);

	tl
		// 6) LA CÁMARA SE DESPLAZA DE LADO. En cuanto la punta de la asíntota
		//    nueva pasa por el centro de la pantalla: el título y las cards —ya
		//    sin protagonismo— se van hacia la izquierda hasta salir de cuadro;
		//    la asíntota se queda (es lo único que "sigue creciendo"); y el
		//    fondo de estrellas deriva hacia la izquierda para vender que
		//    seguimos moviéndonos, ahora de lado en vez de hacia arriba.
		.to(spaceFeatures, { x: () => -window.innerWidth * 1.3, duration: 2.4, ease: "power1.in" }, LINE_CENTER_AT);
}
