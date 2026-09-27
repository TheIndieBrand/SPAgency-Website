// act 2: the limit toward infinity; the "89K+ Raids bloqueados" title forms
// from the stats grid and the number travels to the "x".
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
	// ============ ACT 2: the limit toward infinity ============
	// step 1: the hero's old title fades out and, OVERLAPPING with it, the
	// "lim / x ⟶ ∞" limit comes in (already positioned over the rect the
	// title occupied). right after — without a pause — the title's
	// formation kicks off (step 2), so the limit's appearance and what
	// follows feel like one single gesture, not two separate beats.
	//
	// the #asymptote-scene container is made visible only so the limit
	// block can show; the grid (#asymptote-grid) stays clipped to nothing
	// until the finale.
	tl.to(asymptoteScene, { opacity: 1, duration: 0.5, ease: "none" }, 3.2)
		.to(heroTitle, { opacity: 0, duration: 0.6, ease: "power1.out" }, 3.2)
		// overlaps the end of the title's fade (doesn't wait for it to finish).
		.to(limitBlock, { opacity: 1, duration: 0.7, ease: "none" }, 3.6);

	// ---- the "89K+ Raids bloqueados" title FORMS from the grid ----
	// the second cell releases its two REAL pieces: the "89K+" number
	// detaches from its spot and, at the same time, the "Raids bloqueados"
	// label grows and positions itself right next to it, already below the
	// limit. since these are <Stats/>'s real elements, the title "forms"
	// instead of appearing out of nowhere. (the rest of the grid separates
	// and fades out — see (c) below. the radar stays on screen, just
	// rotating a bit more.)

	// PENDING — the radar stays visible for now (it'll fade out in a later
	// step). code kept for reference:
	// tl.to(radarWrapper, { opacity: 0, duration: 0.6, ease: "power1.out" }, 5.4);

	// on detaching (4.2) the number and label leave their cell's dom and
	// get attached to #asymptote-scene instead. this is needed because in
	// (c) the now-empty cell moves with a transform, and a transformed
	// ancestor would become the containing block for these `position:
	// fixed` elements, throwing them off.
	//
	// the reparent and the switch to `fixed` happen TOGETHER in the same
	// callback (at the same position, 4.2) so there's never a frame with
	// the element already reparented but still in normal flow — that used
	// to flash it for an instant in #asymptote-scene's top-left corner.
	// `reattach` at 4.1 undoes the reparent and clears styles to go back
	// to the grid. both callbacks are kept idempotent and valid in either
	// scroll direction.
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
		color: "#6e6e6e", // = --color-text-faint (explicit starting point for GSAP)
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
		// "first: the 89K+ leaves its position" — travels to below the limit.
		.to(
			raidsNumber,
			{ left: numberTargetLeft, top: numberTargetTop, duration: 1.8, ease: "power2.inOut" },
			4.2,
		)
		// "at the same time: the label grows large and repositions next to it".
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
		// smooth transition from muted "Raids bloqueados" → title: weight
		// rises 400→700 (gsap steps it through 500/600, no abrupt jump) and
		// the color goes from faint to full. shorter than the travel, so it
		// arrives already formed.
		.to(
			raidsLabel,
			{ fontWeight: 700, color: "#eeeeee", duration: 1, ease: "power1.inOut" },
			4.2,
		);

	// while the title is repositioning (≈4.2–6.0) three more things happen:

	// (a) more math symbols appear scattered across the whole screen, with
	//     a small random stagger and entering from a bit lower and
	//     shrunk, so they "sprout" instead of switching on all at once.
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

	// (b) the radar spins a bit more (continuing from where act 1 left it).
	tl.to(
		radarPlane,
		{ rotationZ: "+=14", rotationX: "+=7", duration: 1.8, ease: "power1.inOut" },
		4.2,
	);

	// (c) the FOUR stat cells fan out from the center and fall downward,
	//     with a staggered start so they don't all leave at once. the
	//     second one (already with its content detached) moves too, with a
	//     small offset, so it doesn't sit still while the others move. the
	//     fade-out is handled by the whole section's fade (right below),
	//     which also takes the grid's frame with it.
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
	// long fade of the whole stats section (frame + cells + empty gap) —
	// "let them take their time fading out".
	tl.to(statsSection, { opacity: 0, duration: 3, ease: "power1.in" }, 4.2);

	// once the title is formed, "89K+" keeps traveling to occupy the
	// limit's "x" gap, shrinking as it goes to fit (NUMBER_ON_X_SIZE),
	// while the "x" fades out. the "Raids bloqueados" label stays put
	// there. we reassert the already-formed positions first (idempotent).
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
		// the label repositions CENTERED under the limit and, at the same
		// time, the " = x" suffix appears: it reads "Raids bloqueados = x"
		// aligned to the "lim" block's center.
		.to(raidsLabel, { left: labelReflowLeft, duration: 1, ease: "power2.inOut" }, 6.4)
		.set(raidsEqx, { display: "inline" }, 6.4)
		.to(raidsEqx, { opacity: 1, duration: 0.5, ease: "power1.out" }, 6.45)
		// the "x" fades out early, while the number is still on its way.
		.to(limitX, { opacity: 0, duration: 0.4, ease: "none" }, 6.5);
}
