// phase C: the "Funciones" section over space, the moon, and the block's turn.
import { gsap } from "gsap";
import type { SceneRefs } from "../dom";
import { C_DUR, SC, LINE_CENTER_AT } from "../timing";

// outro's turn for the features section (degrees). sign = direction.
const CARDS_SPIN = 90;
// how much the already-turned title+cards block DROPS (fraction of
// viewport height), to leave room for the new asymptote. at real size, not scaled.
const BLOCK_DROP = 0.2;

export function setupFeatures(r: SceneRefs) {
	const { moon, spaceFeaturesHeading, spaceFeaturesCards } = r;
	// ---- PHASE C: the FEATURES section enters over space ----
	// the exponential keeps growing on the left.
	//  1) the centered titles come in;
	//  2) as scrolling continues: the subtitle leaves and the title rises a bit;
	//  3) the 6 cards appear (centered grid, dark/translucent, floating);
	//  4) the moon crosses top to bottom, faint → "we keep rising".
	const starRot = { v: 0 }; // proxy to rotate the tip's little star
	gsap.set(spaceFeaturesHeading, { xPercent: -50, y: 26 });
	gsap.set(spaceFeaturesCards, { xPercent: -50, y: 40 });
	// the moon enters from the top-right and descends along a curved
	// diagonal (X uses a different ease than Y) until it exits bottom-left.
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
		// 1) titles
		.to(spaceFeatures, { opacity: 1, duration: 1, ease: "none" }, SC)
		.to(spaceFeaturesHeading, { opacity: 1, y: 0, duration: 1.2, ease: "power2.out" }, SC + 0.5)
		// 2) the subtitle leaves and the title rises to make room
		.to(spaceFeaturesSub, { opacity: 0, duration: 0.8, ease: "power1.in" }, SC + 3.6)
		.to(spaceFeaturesHeading, { y: -130, duration: 1.3, ease: "power2.inOut" }, SC + 3.8)
		// 3) the cards come in (the gentle float is done by each card's css)
		.to(spaceFeaturesCards, { opacity: 1, y: 0, duration: 1.1, ease: "power2.out" }, SC + 4.3)
		// 4) the moon crosses along a curved diagonal, very faint (distant) →
		//    sense of continued rising. Y descends at a constant,
		//    scroll-locked pace while X drifts with a different ease, so
		//    the path isn't a straight line.
		.to(moon, { opacity: 0.16, duration: 1.4, ease: "power1.out" }, SC + 3.4)
		.to(moon, { y: () => window.innerHeight * 1.15, duration: 7.5, ease: "none" }, SC + 3.4)
		// the background stars also descend (parallax: much less than the
		// moon) → reinforces the sense that we keep rising. they BRAKE
		// gradually (power2.out, not "none") instead of stopping abruptly,
		// right around when the old asymptote starts disappearing (SC + 10).
		.to(spaceStars, { y: () => window.innerHeight * 0.368, duration: 7.4, ease: "power2.out" }, SC + 3.4)
		.to(
			moon,
			{ x: () => -window.innerWidth * 0.1, duration: 7.5, ease: "sine.inOut" },
			SC + 3.4,
		)
		// the moon fades out completely as it exits below → it's already
		// gone before the turn.
		.to(moon, { opacity: 0, duration: 2, ease: "power1.in" }, SC + 8.9)
		// while the moon is on screen, the tip's little star spins a bit →
		// so it doesn't look pinned. rotated via the svg `transform`
		// attribute (`rotate(n)` with no center = rotates around its local
		// (0,0), which is exactly the star's center) so it does NOT
		// shift — with gsap's `rotation` property the transformOrigin ended up off-center.
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
		// 5) THE TURN. once phase C ends, the title and cards turn
		//    TOGETHER as one block (the whole #space-features rotates), AT
		//    REAL SIZE — no rescaling. it only DROPS a little
		//    (BLOCK_DROP) to leave room for the new asymptote; overflowing
		//    at the bottom is acceptable.
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
		// the plane's curve (inside the svg, distorted by
		// preserveAspectRatio) doesn't rotate well, so it MARCHES off
		// downward instead — a bit before the turn: right as the moon, now
		// past, is about to hide.
		.to(curveTilt, { y: 900, opacity: 0, duration: 2.2, ease: "power2.in" }, SC + 10);

	tl
		// 6) THE CAMERA SHIFTS SIDEWAYS. as soon as the new asymptote's tip
		//    passes the screen's center: the title and cards — no longer
		//    the focus — move left until they exit frame; the asymptote
		//    stays (it's the only thing that "keeps growing"); and the
		//    star background drifts left to sell that we keep moving, now
		//    sideways instead of upward.
		.to(spaceFeatures, { x: () => -window.innerWidth * 1.3, duration: 2.4, ease: "power1.in" }, LINE_CENTER_AT);
}
