// mounts the home page's intro scene: queries the dom, measures, builds the
// timeline (one act per module, in the usual order) and hooks it to scroll.
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { queryScene } from "./dom";
import { prepareScene } from "./prepare";
import { ANCHOR_FEATURES_AT, ANCHOR_HOW_AT, TL_UNITS_BASE, TL_VIEWPORTS_BASE, RUMBLE_START } from "./timing";
import { addHeroStatsAct } from "./acts/hero-stats";
import { addLimitAct } from "./acts/limit";
import { addBurstAct } from "./acts/burst";
import { addTravelAct } from "./acts/travel";
import { setupFeatures, addFeaturesAct } from "./acts/features";
import { setupBlackhole, addFinaleAct } from "./acts/finale";
import { createOutro } from "./outro/outro";
import { bindNavAnchors } from "./anchors";

gsap.registerPlugin(ScrollTrigger);

export function mountScene() {
	const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	const refs = queryScene();

	if (!refs || reduceMotion) {
		// missing dom pieces (or reduced-motion is on): the scene is abandoned
		// and it falls back to the simple version. removing the attribute is
		// enough: the global css shows the static-only sections and hides the scene-only ones.
		delete document.documentElement.dataset.scene;
		return;
	}

	// data-scene="on" was already set by index.astro's <head> script (the
	// global css toggles between the scene and the simple version off it,
	// and the footer goes black to blend seamlessly with space).
	const { introScene } = refs;
	const m = prepareScene(refs);

	// the pin is created BEFORE building the acts, as always: on pinning,
	// ScrollTrigger gives #intro-scene a transform and a fixed height, which
	// turns it into the containing block for the scene's `fixed` elements.
	// layoutOutro's measurements (when building the final act) depend on
	// that, so creating the pin afterward would change the outro's geometry.
	//
	// its length, though, is proportional to the timeline's REAL duration:
	// `end` is evaluated lazily (invalidateOnRefresh) and a refresh once
	// building finishes recalculates it with every act already added.
	// rounded to a tenth so a tiny tweak to one act doesn't change the
	// scroll pace. a fixed distance instead of "+=100%": that percentage is
	// measured against the pinned element's own height, which isn't a
	// stable reference here and once produced a spacer over 12000px tall.
	const tl = gsap.timeline({ paused: true });
	const sceneUnits = () => (tl.duration() > 0 ? Math.round(tl.duration() * 10) / 10 : TL_UNITS_BASE);
	const st = ScrollTrigger.create({
		animation: tl,
		trigger: introScene,
		start: "top top",
		end: () => `+=${window.innerHeight * TL_VIEWPORTS_BASE * (sceneUnits() / TL_UNITS_BASE)}`,
		scrub: 1,
		pin: true,
		invalidateOnRefresh: true,
	});

	addHeroStatsAct(tl, refs, m);
	addLimitAct(tl, refs, m);
	addBurstAct(tl, refs, m);
	addTravelAct(tl, refs, m);

	const { starRot } = setupFeatures(refs);
	setupBlackhole(refs);
	const outro = createOutro(refs);
	addFeaturesAct(tl, refs, starRot);
	addFinaleAct(tl, refs, outro);

	// development only (vite strips it from the build): exposes the timeline
	// so the scene can be inspected from the console — tl.scrollTrigger.disable(false)
	// and tl.time(t) put the scene at any moment without scrolling.
	if (import.meta.env.DEV) (window as unknown as { __introTl?: gsap.core.Timeline }).__introTl = tl;

	// the black hole's rumble runs in real time: while the scene is pinned
	// and time has passed RUMBLE_START, it repaints every frame even if the
	// user isn't scrolling (otherwise it would only shake while scrolling).
	gsap.ticker.add(() => {
		if (outro.clock.t < RUMBLE_START || !tl.scrollTrigger?.isActive) return;
		outro.render(outro.clock.t);
	});

	tl.addLabel("features", ANCHOR_FEATURES_AT).addLabel("how", ANCHOR_HOW_AT);

	// with every act added, the duration is now the real one: recalculates the length.
	st.refresh();

	bindNavAnchors(tl);
}
