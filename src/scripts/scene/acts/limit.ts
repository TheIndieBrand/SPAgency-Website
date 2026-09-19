// Acto 2: el límite hacia el infinito; el título "89K+ Raids bloqueados" se forma
// a partir de la grilla de stats y el número viaja hasta la "x".
import { gsap } from "gsap";
import type { SceneRefs } from "../dom";
import type { Measurements } from "../prepare";

export function addLimitAct(tl: gsap.core.Timeline, r: SceneRefs, m: Measurements) {
	const {
		heroTitle,
		radarPlane,
		statsSection,
		raidsNumber,
		raidsLabel,
		raidsCell,
		statCells,
		asymptoteScene,
		limitBlock,
		limitX,
		asymptoteGlyphs,
	} = r;
	const {
		numberRestRect,
		labelRestRect,
		titleFontSize,
		raidsEqx,
		numberTargetLeft,
		numberTargetTop,
		labelTargetLeft,
		labelTargetTop,
		labelReflowLeft,
		numberFinalLeft,
		numberFinalTop,
		NUMBER_ON_X_SIZE,
	} = m;
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
}
