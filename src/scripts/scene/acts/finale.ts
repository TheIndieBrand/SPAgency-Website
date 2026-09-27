// final act: the black hole crosses and returns, the community rises, and
// the outro's clock (a single linear tween) feeds renderOutro every frame.
import { gsap } from "gsap";
import type { SceneRefs } from "../dom";
import type { Outro } from "../outro/outro";
import {
	OUTRO_LINE_AT,
	LINE_CENTER_AT,
	BLACKHOLE_START_OFFSET,
	BLACKHOLE_CROSS_DUR,
	OUTRO_END,
	BLACKHOLE_DEFAULT_YAW,
	COMMUNITY_HEADING_AT,
	COMMUNITY_FADE_AT,
	COMMUNITY_FADE_DUR,
	DIVE_START,
	DIVE_DUR,
} from "../timing";

export function setupBlackhole(r: SceneRefs) {
	const { outroBlackhole } = r;
	// black hole: centered on X, DROPPED half a viewport (its center falls
	// on the bottom edge → only the top half peeks in). starts off-screen
	// to the right, so the component's IntersectionObserver keeps it
	// PAUSED (no GPU cost) until it enters frame during the final stretch.
	gsap.set(outroBlackhole, {
		xPercent: -50,
		yPercent: -50,
		x: () => window.innerWidth * 1.2,
		y: () => window.innerHeight * 0.5,
		opacity: 0,
	});
}

export function addFinaleAct(tl: gsap.core.Timeline, r: SceneRefs, outro: Outro) {
	const { community, outroBlackholeCanvas } = r;
	const { clock: outroClock, render: renderOutro } = outro;
	const blackholeOrbit = { yaw: BLACKHOLE_DEFAULT_YAW };

	tl
		// …and the new asymptote DRAWS from left to right. the stroke is
		// NOT scaled (clip-path, not scaleX) → it doesn't "stretch". the
		// little star is the advancing tip; the stroke's left end is born
		// off-screen → a cut edge is never visible. it ends up lying near
		// the right edge.
		// final act's clock: a single linear tween that, at every moment,
		// equals the timeline's own time. every frame, renderOutro derives
		// from it EVERYTHING that follows the camera — the little star and
		// the asymptote's stroke, the star background, and the community
		// cards — so they can never fall out of sync. (the black hole does
		// NOT hang off this: it runs on its own tweens below, unchanged.)
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
		);

	tl
		// 7) THE BLACK HOLE. it crosses during the final stretch: enters
		//    from the right, low (only the top half peeks in), the
		//    "camera" passes it by and it exits to the left. constant,
		//    slow movement. its position (and its return from below in
		//    part B) is computed by renderOutro, not a tween: that way the
		//    crossing and the return come from the same source.
		// the black hole itself also "lives" while it crosses: without
		// this it's a rigid sprite sliding by. BLACKHOLE_DEFAULT_YAW must
		// match BlackHole.astro's DEFAULT_YAW (it's the turn's starting
		// point). since the disk is symmetric around the camera's axis,
		// orbiting in yaw doesn't change the ring's outline, but it DOES
		// sweep the Doppler-beaming arc (the disk's "bright" side) around
		// the hole and slides the star background seen through it — it
		// reads as a real spin, not a plain shift.
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
		// on its way back below (part B) it keeps spinning slowly,
		// resuming the heading the crossing left it at.
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
		// during the fall it spins faster and faster (dragging the
		// Doppler glow and the stars around the disk: a swirling sensation).
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
		// 8) THE COMMUNITY. once the black hole has almost exited to the
		//    left, the heading appears (centered) and, once the turn
		//    ends, the testimonials (all of them) rise from below,
		//    centered on screen, with the asymptote falling to their
		//    right. their movement is NOT its own tween: the cards belong
		//    to the camera's world (see renderOutro) and rise as much as
		//    it descends. the window is masked: they fade in under the
		//    heading instead of overlapping it. the last card settles
		//    near the bottom edge; once the pin releases, the content
		//    keeps rising with scroll at a similar pace, with no cut.
		.to(community, { opacity: 1, duration: 1, ease: "power1.out" }, COMMUNITY_HEADING_AT)
		// 9) THE FINISH. with the last card centered and read, the
		//    heading and all the cards fade out together to make way for
		//    the next section; afterward the asymptote settles in the
		//    center (see settle in renderOutro) and the camera, already
		//    braked, leaves a still shot.
		.to(community, { opacity: 0, duration: COMMUNITY_FADE_DUR, ease: "none" }, COMMUNITY_FADE_AT);
}
