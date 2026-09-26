// the curve's travel across the plane, the captions, and the jump into space.
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
	// 5. THE TRAVEL. the curve/function draws at a CONSTANT PACE (ease
	//    "none") over A LOT of scroll; it never finishes drawing
	//    (FRAC_C_END < 1) → it always "keeps growing toward infinity".
	//
	//    phase A (frac ≤ FRAC_A_END): the camera does NOT follow at first;
	//    only once the tip passes ~half the screen (FOLLOW_START_X) does it
	//    engage via smoothstep (no jerk), pinning the tip there on X while
	//    following its vertical movement, damped (VERT_FOLLOW), on Y.
	//    phase B (≤ FRAC_B_END): the curve shoots up nearly vertical — the
	//    camera FOLLOWS it upward (X stable, Y nearly 1:1) → we rise into "space".
	//    phase C (> FRAC_B_END): the camera PINS the tip at a fixed
	//    top-left point (TIP_SCREEN_X/Y) → the tip is always visible and
	//    the stroke flows downward, giving the sense of continued growth.
	//    the right half stays free for the features section.
	const FOLLOW_START_X = 500; // viewBox X (~half screen) past which it follows
	const FOLLOW_RAMP = 220; // units over which it engages (smoothstep)
	const VERT_FOLLOW = 0.6; // damping of the vertical follow in phase A (subtle)
	const VERT_FOLLOW_B = 0.9; // vertical follow in phase B (rising into space)
	// fractions of DRAWN curve that mark the boundaries of each travel phase:
	const FRAC_A_END = 0.32; // end of phase A (travel across the plane)
	const FRAC_B_END = 0.43; // end of phase B (rise into space)
	const FRAC_C_END = 0.97; // drawn up to here (never 1 → "keeps growing toward ∞")
	// in phase C the tip is PINNED at this screen point (viewBox 1000x600):
	// top-left, so it's always visible and leaves the right half free.
	const TIP_SCREEN_X = 150;
	const TIP_SCREEN_Y = 200;
	const C_TURN = 0.12; // initial stretch of phase C where the camera engages
	const GLYPH_PARALLAX = 0.62; // the background letters move less than the camera
	const curvePath = asymptoteCurve as unknown as SVGPathElement;
	const smoothstep = (k: number) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));

	// projections of the tip onto the axes. the plane's X axis sits at
	// y=560 and the Y axis at x=40 (viewBox). X_UNIT/Y_UNIT convert
	// viewBox units into the "real numbers" shown on each axis.
	const AXIS_X_Y = 560;
	const AXIS_Y_X = 40;
	const X_UNIT = 46;
	const Y_UNIT = 24;
	// the X label is offset to the side (to the right of the vertical
	// line) and above the axis; the Y label sits above the horizontal line.
	gsap.set(curveProjXLabel, { xPercent: 0, yPercent: -100 });
	gsap.set(curveProjYLabel, { xPercent: -100, yPercent: -100 });

	// curve's y at x = FOLLOW_START_X (reference for the vertical follow).
	let followStartY = 0;
	for (let i = 0; i <= 240; i++) {
		const pt = curvePath.getPointAtLength((curveLength * i) / 240);
		if (pt.x >= FOLLOW_START_X) {
			followStartY = pt.y;
			break;
		}
	}

	// curve tip at the end of phase A (to follow it without a jump in B).
	const headA0 = curvePath.getPointAtLength(curveLength * FRAC_A_END);

	let camAEndTx = 0;
	let camAEndTy = 0;
	let camBEndTx = 0;
	let camBEndTy = 0;


	// proxy: fraction of curve drawn. a shared onUpdate reads it and splits
	// camera / drawing according to the phase. never reaches 1
	// (FRAC_C_END) → there's always curve left to draw and the tip keeps moving.
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
			// phase A: the camera engages past half-screen and follows the tip.
			const engage = smoothstep((head.x - FOLLOW_START_X) / FOLLOW_RAMP);
			tx = (FOLLOW_START_X - head.x) * engage;
			ty = (followStartY - head.y) * VERT_FOLLOW * engage;
			camAEndTx = tx;
			camAEndTy = ty;
			camBEndTx = tx;
			camBEndTy = ty;
		} else if (frac <= FRAC_B_END) {
			// phase B: rise into space, following the tip upward.
			tx = camAEndTx - (head.x - headA0.x);
			ty = camAEndTy - (head.y - headA0.y) * VERT_FOLLOW_B;
			camBEndTx = tx;
			camBEndTy = ty;
		} else {
			// phase C: the camera PINS the tip at a fixed screen point
			// (top-left). the tip is always visible; the sense of growth
			// comes from the stroke, which flows down below the tip as we
			// "rise". engages from phase B with a short smoothstep so it
			// doesn't jerk.
			const fc = (frac - FRAC_B_END) / (FRAC_C_END - FRAC_B_END);
			const k = smoothstep(Math.min(fc / C_TURN, 1));
			// the tip stays PINNED at (TIP_SCREEN_X, TIP_SCREEN_Y) for all
			// of phase C. tilting the line is NOT done here: at the end,
			// the outro rotates #curve-tilt 90° together with the features section.
			const targetTx = TIP_SCREEN_X - head.x;
			const targetTy = TIP_SCREEN_Y - head.y;
			tx = camBEndTx + (targetTx - camBEndTx) * k;
			ty = camBEndTy + (targetTy - camBEndTy) * k;
		}
		gsap.set(asymptoteDrift, { x: tx, y: ty });
		gsap.set(asymptoteCurveHead, { x: head.x, y: head.y });

		// the background math letters follow the camera with parallax.
		gsap.set(asymptoteGlyphLayer, {
			x: ((tx * vw) / 1000) * GLYPH_PARALLAX,
			y: ((ty * vh) / 600) * GLYPH_PARALLAX,
		});

		// projections onto the axes: only in phase A (afterward that group fades out).
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
		// the tip's dot and the projections appear as the travel starts and
		// retreat before the rise into space.
		.to(asymptoteCurveHead, { opacity: 1, duration: 0.3, ease: "power1.out" }, TRAVEL_START)
		.to([curveProj, curveProjLabels], { opacity: 1, duration: 0.5, ease: "power1.out" }, TRAVEL_START + 0.4)
		.to([curveProj, curveProjLabels], { opacity: 0, duration: 0.6, ease: "power1.in" }, TRAVEL_START + 9);

	// captions in the top-left corner as the function grows. they appear
	// in sequence (first "SP Agency, obra de ingeniería.", then "Latencia
	// estudiada al milisegundo"), with a slight slide. opaque gray
	// background (in the markup) so the grid doesn't show through behind them.
	gsap.set([travelCaption1, travelCaption2], { y: 14, opacity: 0 });
	tl.to(travelCaption1, { opacity: 1, y: 0, duration: 0.8, ease: "power2.out" }, TRAVEL_START + 1)
		.to(travelCaption1, { opacity: 0, y: -14, duration: 0.7, ease: "power1.in" }, TRAVEL_START + 5)
		.to(travelCaption2, { opacity: 1, y: 0, duration: 0.8, ease: "power2.out" }, TRAVEL_START + 5.6)
		.to(travelCaption2, { opacity: 0, y: -14, duration: 0.9, ease: "power1.in" }, TRAVEL_START + 9.6);

	// ---- JUMP INTO SPACE (travel's phase B: the curve shoots up vertical) ----
	// the plane and the letters fade out, the gray background turns black,
	// the curve shifts to white, the tip crossfades into a little star and
	// the stars appear. (frac crosses FRAC_A_END ~10s into the A+B stretch.)
	const PHASE_B_START = TRAVEL_START + 10;
	// ONLY the grid+axes (#grid-lines) and the letters fade out — not the
	// CURVE, since the function never disappears.
	tl.to([gridLines, asymptoteGlyphLayer], { opacity: 0, duration: 2, ease: "power1.in" }, PHASE_B_START)
		.to(spaceBg, { opacity: 1, duration: 2.2, ease: "power1.inOut" }, PHASE_B_START)
		.to(asymptoteCurve, { stroke: "#eeeeee", duration: 2.4, ease: "none" }, PHASE_B_START)
		.to(spaceStars, { opacity: 1, duration: 2.4, ease: "power1.out" }, PHASE_B_START + 0.5)
		.to(curveHeadDot, { opacity: 0, duration: 0.6, ease: "power1.in" }, PHASE_B_START + 0.6)
		.to(curveHeadStar, { opacity: 0.85, duration: 0.7, ease: "power1.out" }, PHASE_B_START + 0.6);
}
