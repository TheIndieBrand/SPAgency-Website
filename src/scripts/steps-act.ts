// Acto de los pasos ("Configurado en tres pasos"): cada paso es un NODO del
// camino que sigue la asíntota. Este módulo coloca los nodos en coordenadas
// del MUNDO de la cámara (la misma que arrastra el fondo, la línea y las
// tarjetas — ver intro-scene.ts), detecta el instante en que la punta de la
// asíntota toca cada nodo y dispara sus efectos.
//
// Reparto de responsabilidades:
//  · Lo continuo (posición de la cámara, del camino, de los nodos) va atado al
//    scroll y se recalcula en cada render(): es función pura del tiempo.
//  · Los IMPACTOS (relleno, aro continuo, onda, chispas, shake) son animaciones
//    en TIEMPO REAL que se disparan al cruzar cada contacto. Si fueran
//    scrub, al scrollear despacio el shake saldría en cámara lenta. El estado
//    "completado" sí es función del tiempo: al retroceder por debajo del
//    contacto el nodo se restaura.
import { gsap } from "gsap";

// Instantes de contacto, en unidades de timeline RELATIVAS a LINE_CENTER_AT.
export const STEP_CONTACT_OFFSETS = [30.4, 34.0, 37.6];

// Radio del aro (px): la punta toca el nodo por arriba, así que el centro del
// nodo queda STEP_RADIUS por debajo de la punta en el instante de contacto.
export const STEP_RADIUS = 34;

// "Hit-stop": la cámara se frena un instante en cada contacto para dar peso al
// impacto (más fuerte en cada paso). La ventana empieza un poco antes del
// contacto y dura HIT_LEN unidades; el freno sigue un sin² (suave).
const STEP_HIT_DEPTH = [0.45, 0.55, 0.7];
const HIT_LEAD = 0.15;
const HIT_LEN = 1.0;

export function hitStopFactor(rel: number): number {
	let factor = 1;
	for (let k = 0; k < STEP_CONTACT_OFFSETS.length; k++) {
		const u = (rel - (STEP_CONTACT_OFFSETS[k] - HIT_LEAD)) / HIT_LEN;
		if (u > 0 && u < 1) factor *= 1 - STEP_HIT_DEPTH[k] * Math.sin(Math.PI * u) ** 2;
	}
	return factor;
}

// Intensidad de cada impacto: cada paso "pega" más fuerte que el anterior.
interface Level {
	cam: number; // amplitud del shake de cámara (px)
	camDur: number; // s
	text: number; // amplitud del shake del texto (px)
	rot: number; // grados
	textDur: number; // s
	sparks: number;
	shocks: number;
	sparkDist: [number, number];
}
const LEVELS: Level[] = [
	{ cam: 3, camDur: 0.5, text: 6, rot: 0.8, textDur: 0.55, sparks: 12, shocks: 1, sparkDist: [46, 84] },
	{ cam: 6, camDur: 0.6, text: 10, rot: 1.4, textDur: 0.65, sparks: 14, shocks: 1, sparkDist: [56, 100] },
	{ cam: 13, camDur: 1.0, text: 19, rot: 2.6, textDur: 1.0, sparks: 14, shocks: 2, sparkDist: [70, 130] },
];

// Ruido determinista de varias frecuencias (u en segundos): sacudida seca, no
// una oscilación limpia. Sin Math.random → mismo shake en cada reproducción.
export const wobble = (u: number, seed: number) =>
	Math.sin(u * 46 + seed) * 0.55 + Math.sin(u * 83 + seed * 1.9) * 0.3 + Math.sin(u * 131 + seed * 2.7) * 0.15;

export interface StepsFrame {
	W: number;
	H: number;
	camX: number; // cámara (ya con el shake sumado)
	camY: number;
	dx: number; // desplazamiento "settle" de la asíntota al centro
	dy: number;
	zoom: number; // zoom de la cámara respecto al centro de la pantalla (cx, cy)
	cx: number;
	cy: number;
}

interface NodeParts {
	root: HTMLElement;
	glow: HTMLElement;
	shocks: HTMLElement[];
	sparks: HTMLElement[];
	ringDash: SVGElement;
	ringFill: SVGElement;
	ringSolid: SVGElement;
	num: SVGElement;
	text: HTMLElement;
	textInner: HTMLElement;
	side: 1 | -1; // +1: texto a la derecha del eje; -1: a la izquierda
}

export function createStepsAct(nodes: HTMLElement[], requestRender: () => void) {
	const parts: NodeParts[] = nodes.map((root, i) => ({
		root,
		glow: root.querySelector<HTMLElement>(".step-glow")!,
		shocks: Array.from(root.querySelectorAll<HTMLElement>(".step-shock")),
		sparks: Array.from(root.querySelectorAll<HTMLElement>(".step-spark")),
		ringDash: root.querySelector<SVGElement>(".ring-dash")!,
		ringFill: root.querySelector<SVGElement>(".ring-fill")!,
		ringSolid: root.querySelector<SVGElement>(".ring-solid")!,
		num: root.querySelector<SVGElement>(".ring-num")!,
		text: root.querySelector<HTMLElement>(".step-text")!,
		textInner: root.querySelector<HTMLElement>(".step-text-inner")!,
		side: i % 2 === 0 ? 1 : -1,
	}));

	// Estado compartido con el render principal.
	const shake = { x: 0, y: 0 }; // shake de CÁMARA
	const starAbsorb = { k: 0 }; // 0 → la estrella está en la punta; 1 → absorbida por el nodo
	const worldY: number[] = parts.map(() => 0);
	let worldX = 0;
	const done = parts.map(() => false);
	const effects: (gsap.core.Timeline | null)[] = parts.map(() => null);
	let shakeTween: gsap.core.Tween | null = null;

	// Estado inicial de cada nodo (también lo que se restaura al retroceder).
	const resetNode = (k: number) => {
		const p = parts[k];
		gsap.set(p.ringDash, { opacity: 1 });
		gsap.set([p.ringFill, p.ringSolid], { strokeDashoffset: 1 });
		gsap.set(p.num, { attr: { fill: "#9b9b9b" }, scale: 1, svgOrigin: "36 37" });
		gsap.set(p.glow, { opacity: 0, scale: 1 });
		gsap.set(p.shocks, { opacity: 0, scale: 1 });
		gsap.set(p.sparks, { opacity: 0, x: 0, y: 0, scale: 1 });
		gsap.set(p.text, { opacity: 0, x: 0, scale: 1, filter: "none" });
		gsap.set(p.textInner, { x: 0, y: 0, rotation: 0 });
	};
	parts.forEach((_, k) => resetNode(k));

	const complete = (k: number) => {
		const p = parts[k];
		const lv = LEVELS[Math.min(k, LEVELS.length - 1)];
		effects[k]?.kill();
		resetNode(k);

		const tl = gsap.timeline();
		effects[k] = tl;

		// 1) El aro punteado se apaga y se cierra a trazo continuo; el disco se
		//    rellena con un barrido horario (círculo grueso con dashoffset).
		tl.to(p.ringDash, { opacity: 0, duration: 0.25, ease: "power1.out" }, 0)
			.to(p.ringSolid, { strokeDashoffset: 0, duration: 0.55, ease: "power2.out" }, 0.05)
			.to(p.ringFill, { strokeDashoffset: 0, duration: 0.75, ease: "power2.inOut" }, 0.1);

		// 2) El número se enciende y da un pequeño rebote al cerrarse el disco.
		tl.to(p.num, { attr: { fill: "#ffffff" }, duration: 0.25 }, 0.4)
			.to(p.num, { scale: 1.28, svgOrigin: "36 37", duration: 0.14, ease: "power2.out" }, 0.55)
			.to(p.num, { scale: 1, svgOrigin: "36 37", duration: 0.45, ease: "elastic.out(1, 0.5)" }, 0.69);

		// 3) Brillo: se enciende de golpe y se queda en un resplandor más suave.
		tl.fromTo(p.glow, { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.4, ease: "power2.out" }, 0.3).to(
			p.glow,
			{ opacity: 0.55, duration: 1.2, ease: "power1.inOut" },
			0.7,
		);

		// 4) Onda(s) expansiva(s).
		p.shocks.slice(0, lv.shocks).forEach((shock, s) => {
			tl.fromTo(
				shock,
				{ scale: 1, opacity: 0.85 },
				{ scale: 3.4 + k * 0.5, opacity: 0, duration: 0.95, ease: "power2.out" },
				0.35 + s * 0.16,
			);
		});

		// 5) Chispas: ráfaga radial, mitad blancas y mitad azules.
		p.sparks.slice(0, lv.sparks).forEach((spark, s) => {
			const angle = (s / lv.sparks) * Math.PI * 2 + (k + 1) * 0.37 + (s % 3) * 0.11;
			const dist = lv.sparkDist[0] + ((s * 37) % 100) / 100 * (lv.sparkDist[1] - lv.sparkDist[0]);
			gsap.set(spark, { background: s % 2 ? "#ffffff" : "#59baf5" });
			tl.fromTo(
				spark,
				{ x: 0, y: 0, scale: 1.3, opacity: 1 },
				{
					x: Math.cos(angle) * dist,
					y: Math.sin(angle) * dist,
					scale: 0.2,
					opacity: 0,
					duration: 0.55 + ((s * 53) % 100) / 250,
					ease: "power3.out",
				},
				0.4,
			);
		});

		// 6) El texto entra de golpe (borroso, grande, desplazado) y se sacude.
		gsap.set(p.text, { transformOrigin: p.side === 1 ? "0% 50%" : "100% 50%" });
		// Al terminar la entrada se quita el filtro (un blur(0px) residual crearía
		// una capa de composición para nada).
		tl.set(p.text, { filter: "none" }, 0.8);
		tl.fromTo(
			p.text,
			{ opacity: 0, x: p.side * 38, scale: 1.08, filter: "blur(10px)" },
			{ opacity: 1, x: 0, scale: 1, filter: "blur(0px)", duration: 0.32, ease: "power3.out" },
			0.42,
		);
		const textProxy = { p: 0 };
		tl.to(
			textProxy,
			{
				p: 1,
				duration: lv.textDur,
				ease: "none",
				onUpdate: () => {
					const env = (1 - textProxy.p) ** 2;
					const u = textProxy.p * lv.textDur;
					gsap.set(p.textInner, {
						x: lv.text * env * wobble(u, k * 3 + 1),
						y: lv.text * 0.7 * env * wobble(u, k * 3 + 5),
						rotation: lv.rot * env * wobble(u, k * 3 + 9),
					});
				},
				onComplete: () => {
					gsap.set(p.textInner, { x: 0, y: 0, rotation: 0 });
				},
			},
			0.42,
		);

		// 7) Shake de cámara: al golpe del contacto (no al texto).
		const camProxy = { p: 0 };
		shakeTween?.kill();
		shakeTween = gsap.to(camProxy, {
			p: 1,
			duration: lv.camDur,
			ease: "none",
			delay: 0.05,
			onUpdate: () => {
				const env = (1 - camProxy.p) ** 2;
				const u = camProxy.p * lv.camDur;
				shake.x = lv.cam * env * wobble(u, k * 7 + 2);
				shake.y = lv.cam * 0.8 * env * wobble(u, k * 7 + 6);
				requestRender();
			},
			onComplete: () => {
				shake.x = 0;
				shake.y = 0;
				requestRender();
			},
		});

		// 8) La estrella de la punta se absorbe dentro del primer nodo.
		if (k === 0) {
			gsap.to(starAbsorb, { k: 1, duration: 0.4, ease: "power2.in", onUpdate: requestRender, overwrite: true });
		}
	};

	const reset = (k: number) => {
		effects[k]?.kill();
		effects[k] = null;
		resetNode(k);
		if (k === 0) gsap.to(starAbsorb, { k: 0, duration: 0.25, ease: "power1.out", onUpdate: requestRender, overwrite: true });
		if (!done.some((d, i) => i !== k && d)) {
			shakeTween?.kill();
			shake.x = 0;
			shake.y = 0;
		}
	};

	return {
		shake,
		starAbsorb,

		// Posición de los nodos en el MUNDO: todos sobre el eje (axisWorldX), cada uno
		// a la altura donde su aro toca la punta en su instante de contacto.
		layout(axisWorldX: number, contactWorldY: (k: number) => number) {
			worldX = axisWorldX;
			for (let k = 0; k < parts.length; k++) worldY[k] = contactWorldY(k);
		},
		worldX: () => worldX,
		worldY: (k: number) => worldY[k],

		// Estado "completado" como función del tiempo (rel = t − LINE_CENTER_AT).
		setTime(rel: number) {
			for (let k = 0; k < parts.length; k++) {
				const isDone = rel >= STEP_CONTACT_OFFSETS[k];
				if (isDone && !done[k]) {
					done[k] = true;
					complete(k);
				} else if (!isDone && done[k]) {
					done[k] = false;
					reset(k);
				}
			}
		},

		render(f: StepsFrame) {
			for (let k = 0; k < parts.length; k++) {
				// Mundo → pantalla, con el zoom de la cámara respecto al centro.
				const x = f.cx + (worldX - f.camX + f.dx - f.cx) * f.zoom;
				const y = f.cy + (worldY[k] - f.camY + f.dy - f.cy) * f.zoom;
				// El nodo mide ~72px de aro, su brillo y la onda llegan a ~250px.
				const margin = 260 * f.zoom;
				const visible = y > -margin && y < f.H + margin;
				const node = parts[k].root;
				node.style.visibility = visible ? "visible" : "hidden";
				if (visible) gsap.set(node, { x, y, scale: f.zoom });
			}
		},
	};
}
