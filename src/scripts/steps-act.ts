// steps act ("configured in three steps"): each step is a NODE on the path
// the asymptote follows. this module places the nodes in the camera's WORLD
// coordinates (the same one dragging the background, the line and the cards
// — see intro-scene.ts), detects the moment the asymptote's tip touches each
// node, and fires its effects.
//
// division of responsibilities:
//  · the continuous part (camera position, path, nodes) is tied to scroll
//    and recomputed on every render(): it's a pure function of time.
//  · the IMPACTS (fill, solid ring, shockwave, sparks, shake) are REAL-TIME
//    animations fired when crossing each contact point. if they were
//    scrubbed, scrolling slowly would put the shake in slow motion. the
//    "completed" state IS a function of time: scrolling back below the
//    contact point restores the node.
import { gsap } from "gsap";

// contact moments, in timeline units RELATIVE to LINE_CENTER_AT.
export const StepContactOffsets = [30.4, 34.0, 37.6];

// ring radius (px): the tip touches the node from above, so the node's
// center sits StepRadius below the tip at the contact moment.
export const StepRadius = 34;

// "hit-stop": the camera briefly slows at each contact to give the impact
// weight (stronger with each step). the window starts a bit before contact
// and lasts HitLen units; the brake follows a sin² curve (smooth).
const StepHitDepth = [0.45, 0.55, 0.7];
const HitLead = 0.15;
const HitLen = 1.0;

export function hitStopFactor(rel: number): number {
	let factor = 1;
	for (let k = 0; k < StepContactOffsets.length; k++) {
		const u = (rel - (StepContactOffsets[k] - HitLead)) / HitLen;
		if (u > 0 && u < 1) factor *= 1 - StepHitDepth[k] * Math.sin(Math.PI * u) ** 2;
	}
	return factor;
}

// intensity of each impact: each step "hits" harder than the previous one.
interface Level {
	cam: number; // camera shake amplitude (px)
	camDur: number; // s
	text: number; // text shake amplitude (px)
	rot: number; // degrees
	textDur: number; // s
	sparks: number;
	shocks: number;
	sparkDist: [number, number];
}
const Levels: Level[] = [
	{ cam: 3, camDur: 0.5, text: 6, rot: 0.8, textDur: 0.55, sparks: 12, shocks: 1, sparkDist: [46, 84] },
	{ cam: 6, camDur: 0.6, text: 10, rot: 1.4, textDur: 0.65, sparks: 14, shocks: 1, sparkDist: [56, 100] },
	{ cam: 13, camDur: 1.0, text: 19, rot: 2.6, textDur: 1.0, sparks: 14, shocks: 2, sparkDist: [70, 130] },
];

// deterministic multi-frequency noise (u in seconds): a sharp jolt, not a
// clean oscillation. no Math.random → same shake on every playback.
export const wobble = (u: number, seed: number) =>
	Math.sin(u * 46 + seed) * 0.55 + Math.sin(u * 83 + seed * 1.9) * 0.3 + Math.sin(u * 131 + seed * 2.7) * 0.15;

export interface StepsFrame {
	W: number;
	H: number;
	camX: number; // camera (with the shake already added)
	camY: number;
	dx: number; // the asymptote's "settle" offset toward the center
	dy: number;
	zoom: number; // camera zoom relative to the screen's center (cx, cy)
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
	side: 1 | -1; // +1: text to the right of the axis; -1: to the left
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

	// state shared with the main render.
	const shake = { x: 0, y: 0 }; // CAMERA shake
	const starAbsorb = { k: 0 }; // 0 → the star is at the tip; 1 → absorbed by the node
	const worldY: number[] = parts.map(() => 0);
	let worldX = 0;
	const done = parts.map(() => false);
	const effects: (gsap.core.Timeline | null)[] = parts.map(() => null);
	let shakeTween: gsap.core.Tween | null = null;

	// each node's initial state (also what's restored when scrolling back).
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
		const lv = Levels[Math.min(k, Levels.length - 1)];
		effects[k]?.kill();
		resetNode(k);

		const tl = gsap.timeline();
		effects[k] = tl;

		// 1) the dashed ring fades and closes into a solid stroke; the disk
		//    fills with a clockwise sweep (thick circle with dashoffset).
		tl.to(p.ringDash, { opacity: 0, duration: 0.25, ease: "power1.out" }, 0)
			.to(p.ringSolid, { strokeDashoffset: 0, duration: 0.55, ease: "power2.out" }, 0.05)
			.to(p.ringFill, { strokeDashoffset: 0, duration: 0.75, ease: "power2.inOut" }, 0.1);

		// 2) the number lights up and gives a small bounce as the disk closes.
		tl.to(p.num, { attr: { fill: "#ffffff" }, duration: 0.25 }, 0.4)
			.to(p.num, { scale: 1.28, svgOrigin: "36 37", duration: 0.14, ease: "power2.out" }, 0.55)
			.to(p.num, { scale: 1, svgOrigin: "36 37", duration: 0.45, ease: "elastic.out(1, 0.5)" }, 0.69);

		// 3) glow: lights up all at once and settles into a softer shine.
		tl.fromTo(p.glow, { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.4, ease: "power2.out" }, 0.3).to(
			p.glow,
			{ opacity: 0.55, duration: 1.2, ease: "power1.inOut" },
			0.7,
		);

		// 4) shockwave(s).
		p.shocks.slice(0, lv.shocks).forEach((shock, s) => {
			tl.fromTo(
				shock,
				{ scale: 1, opacity: 0.85 },
				{ scale: 3.4 + k * 0.5, opacity: 0, duration: 0.95, ease: "power2.out" },
				0.35 + s * 0.16,
			);
		});

		// 5) sparks: a radial burst, half white and half blue.
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

		// 6) the text snaps in (blurred, large, offset) and shakes.
		gsap.set(p.text, { transformOrigin: p.side === 1 ? "0% 50%" : "100% 50%" });
		// once the entrance finishes the filter is removed (a leftover
		// blur(0px) would create a compositing layer for nothing).
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

		// 7) camera shake: on the contact hit (not on the text).
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

		// 8) the tip's star gets absorbed into the first node.
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

		// nodes' position in WORLD space: all on the axis (axisWorldX), each at
		// the height where its ring touches the tip at its contact moment.
		layout(axisWorldX: number, contactWorldY: (k: number) => number) {
			worldX = axisWorldX;
			for (let k = 0; k < parts.length; k++) worldY[k] = contactWorldY(k);
		},
		worldX: () => worldX,
		worldY: (k: number) => worldY[k],

		// "completed" state as a function of time (rel = t − LINE_CENTER_AT).
		setTime(rel: number) {
			for (let k = 0; k < parts.length; k++) {
				const isDone = rel >= StepContactOffsets[k];
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
				// world → screen, with the camera's zoom relative to the center.
				const x = f.cx + (worldX - f.camX + f.dx - f.cx) * f.zoom;
				const y = f.cy + (worldY[k] - f.camY + f.dy - f.cy) * f.zoom;
				// the node's ring is ~72px, its glow and shockwave reach ~250px.
				const margin = 260 * f.zoom;
				const visible = y > -margin && y < f.H + margin;
				const node = parts[k].root;
				node.style.visibility = visible ? "visible" : "hidden";
				if (visible) gsap.set(node, { x, y, scale: f.zoom });
			}
		},
	};
}
