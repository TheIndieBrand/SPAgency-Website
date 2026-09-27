// initial scene state and up-front measurements. everything is measured
// HERE, synchronously and before building the timeline (never inside it):
// these are the measurements the acts use later.
import { gsap } from "gsap";
import type { SceneRefs } from "./dom";

export function prepareScene(r: SceneRefs) {
	const {
		introScene,
		heroTitle,
		radarWrapper,
		radarPlane,
		statsSection,
		statNumbers,
		raidsNumber,
		raidsLabel,
		asymptoteGrid,
		asymptoteCurve,
		limitBlock,
		limitX,
		limitInfinityShake,
		burstDots,
	} = r;
	// <Stats/> renders with the final values (that's what the simple version
	// sees); with the animated scene they start at zero and count up to their
	// value as they enter.
	function resetStatValues() {
		statNumbers.forEach((el) => {
			const decimals = parseInt(el.dataset.decimals || "0", 10);
			const prefix = el.dataset.prefix || "";
			const suffix = el.dataset.suffix || "";
			el.textContent = `${prefix}${(0).toFixed(decimals)}${suffix}`;
		});
	}

	// data-scene="on" was already set by index.astro's <head> script (the
	// global css toggles between the scene and the simple version off it, and
	// the footer goes black to blend seamlessly with space). the stats are
	// zeroed out BEFORE measuring anything: the measurements below are taken
	// with those texts.
	resetStatValues();

	// initial state: stats out of the scene (below the viewport), positioned
	// absolute inside #intro-scene so they can share the screen with the hero
	// while it "shrinks".
	// the stats slide in from below. `top` is animated (not a transform /
	// yPercent) ON PURPOSE: a transform on #stats would turn it into the
	// containing block for its `position: fixed` descendants, and in act 2
	// the "Raids bloqueados" number and label switch to `fixed` to travel to
	// the limit — they need to reference the viewport, not #stats.
	const STATS_TOP_REST = "64%";
	const STATS_TOP_START = "104%";
	gsap.set(statsSection, {
		position: "absolute",
		left: 0,
		right: 0,
		top: STATS_TOP_START,
		opacity: 0,
	});

	gsap.set(radarPlane, {
		transformPerspective: 1000,
		rotationZ: -30,
		rotationX: 60,
	});

	// position of #intro-scene's top edge RIGHT NOW (page unpinned, with the
	// sticky header taking up its space above). once ScrollTrigger pins the
	// scene, #intro-scene ends up fixed with its top at the viewport (y: 0),
	// so everything we measure now sits `introSceneTop` px LOWER than where
	// it'll show up during the pin. we subtract this figure from the
	// positions applied as `fixed` during act 2. since #intro-scene and the
	// pieces are measured at the same synchronous instant, the subtraction
	// holds regardless of the scroll position (both rects shift the same
	// amount with scroll).
	const introSceneTop = introScene!.getBoundingClientRect().top;

	// act 2 — prepare the curve to "draw itself"
	// (stroke-dasharray/dashoffset) and the hidden grid (radius-0 clip). in
	// the finale the clip grows from the exact ∞ point (computed below) until
	// it covers the screen.
	const curveLength = asymptoteCurve!.getTotalLength();
	gsap.set(asymptoteCurve, { strokeDasharray: curveLength, strokeDashoffset: curveLength });
	gsap.set(asymptoteGrid, { clipPath: "circle(0% at 50% 50%)" });
	// tremble amplitude of the ∞ (0 = still); the finale script raises it.
	gsap.set(limitInfinityShake, { "--tremble": 0 });

	// the final value of "Raids bloqueados" (e.g. "89K+"). the number itself
	// is counted by act 1 (it's the real <Stats/> cell); here we just
	// rebuild the same text so we can measure its final width below.
	const raidsTarget = parseFloat(raidsNumber!.dataset.target || "0");
	const raidsDecimals = parseInt(raidsNumber!.dataset.decimals || "0", 10);
	const raidsPrefix = raidsNumber!.dataset.prefix || "";
	const raidsSuffix = raidsNumber!.dataset.suffix || "";
	const raidsText = `${raidsPrefix}${raidsTarget.toFixed(raidsDecimals)}${raidsSuffix}`;
	const raidsZeroText = `${raidsPrefix}${(0).toFixed(raidsDecimals)}${raidsSuffix}`;

	// where the number and label sit AT REST inside the already-settled grid
	// (top at its final value) and with the final text ("89K+", not "0K+"),
	// so they can detach from there (flip-style) without a visible jump.
	//
	// inside the cell they're block <div>s, centered, with the inherited
	// base line-height, so their getBoundingClientRect() does NOT match
	// where the glyphs are actually painted. we measure with a Range over
	// the content instead: that gives the box fitted to the painted text
	// (real left/top/width). when detaching we set them `fixed` +
	// inline-block + line-height 1, so their box becomes exactly that one,
	// with no jump. all synchronous: we bring the stats to rest, measure,
	// and put them back without anything being painted in between.
	gsap.set(statsSection, { top: STATS_TOP_REST });
	raidsNumber!.textContent = raidsText;

	const measureRenderedText = (el: HTMLElement) => {
		const range = document.createRange();
		range.selectNodeContents(el);
		const r = range.getBoundingClientRect();
		// `top` corrected to "pinned-phase" coordinates (see introSceneTop).
		return { left: r.left, top: r.top - introSceneTop, width: r.width, height: r.height };
	};
	const numberRestRect = measureRenderedText(raidsNumber!);
	const labelRestRect = measureRenderedText(raidsLabel!);

	raidsNumber!.textContent = raidsZeroText;
	gsap.set(statsSection, { top: STATS_TOP_START });

	// size of the already-"formed" title: the label grows to the number's
	// body size; the number never changes size.
	const titleFontSize = parseFloat(window.getComputedStyle(raidsNumber!).fontSize) || 32;

	// " = x" suffix added to the label when "89K+" occupies the "x": it
	// reads "lim (…→∞) / Raids bloqueados = x". lives inside #raids-label
	// (so it moves/scales/bursts with it); starts hidden. the "=" in a muted
	// tone and the "x" in italic serif, matching the limit's original "x".
	const raidsEqx = document.createElement("span");
	raidsEqx.setAttribute("aria-hidden", "true");
	raidsEqx.style.cssText = "display:none;opacity:0;white-space:pre;font-weight:400;color:#6e6e6e;";
	raidsEqx.textContent = "  =  ";
	const raidsEqxVar = document.createElement("span");
	raidsEqxVar.textContent = "x";
	raidsEqxVar.style.cssText =
		'font-family:ui-serif,Georgia,"Times New Roman",serif;font-style:italic;color:#eeeeee;';
	raidsEqx.appendChild(raidsEqxVar);
	raidsLabel!.appendChild(raidsEqx);

	// width of "Raids bloqueados = x" ALREADY at title size (display, bold),
	// with the suffix visible, so that whole group can be centered under the
	// "lim" block once "89K+" leaves. synchronous measurement, applying the
	// style for an instant.
	const _lst = raidsLabel!.style;
	const _lstPrev = {
		ff: _lst.fontFamily,
		fw: _lst.fontWeight,
		fs: _lst.fontSize,
		ws: _lst.whiteSpace,
	};
	_lst.fontFamily = "var(--font-display)";
	_lst.fontWeight = "700";
	_lst.fontSize = `${titleFontSize}px`;
	_lst.whiteSpace = "nowrap";
	raidsEqx.style.display = "inline";
	const labelFullWidth = measureRenderedText(raidsLabel!).width;
	raidsEqx.style.display = "none";
	_lst.fontFamily = _lstPrev.ff;
	_lst.fontWeight = _lstPrev.fw;
	_lst.fontSize = _lstPrev.fs;
	_lst.whiteSpace = _lstPrev.ws;

	// the "lim / x → ∞" block must appear right where the hero title was
	// (not in a fixed corner) — we measure the title's rect already with the
	// small downward offset it gets in act 1 (y: 50, see the tween below),
	// so the limit lands exactly where the title ends up as it fades. same
	// synchronous trick: apply the offset, measure, and put it back to 0
	// without anything being painted in between.
	gsap.set(heroTitle, { y: 50 });
	const heroTitleRect = heroTitle!.getBoundingClientRect();
	gsap.set(heroTitle, { y: 0 });

	// the "lim / x → ∞" block is quite a bit taller than the title (large
	// type), so to really sit IN the title's place (not just share its top
	// edge) we center it vertically on the strip the title occupied,
	// keeping the same left margin. we measure its natural height by
	// setting it fixed at (0,0) for an instant (there it already has its
	// real shrink-to-fit size, unlike when static and filling its
	// container's full width).
	gsap.set(limitBlock, { position: "fixed", left: 0, top: 0 });
	const limitNaturalRect = limitBlock!.getBoundingClientRect();

	// fine tuning over the title's strip: we nudge it a bit to the right and
	// slightly higher so it doesn't sit flush against the left margin.
	// applied in this gsap.set() — before measuring xRect / limitBlockRect
	// below — so everything computed from its position still lines up.
	const LIMIT_OFFSET_X = 140;
	const LIMIT_OFFSET_Y = -48;
	const limitTop =
		heroTitleRect.top + heroTitleRect.height / 2 - limitNaturalRect.height / 2 + LIMIT_OFFSET_Y;
	gsap.set(limitBlock, { left: heroTitleRect.left + LIMIT_OFFSET_X, top: limitTop });

	// we measure EVERYTHING up front (never inside the scrubbed timeline — a
	// tl.call() there would fire every time scroll crosses that point, in
	// both directions, duplicating tweens). now that limitBlock already has
	// its final position fixed above (only its opacity is animated from
	// here on, which doesn't affect layout), its rect and the "x"'s are
	// already final.
	const xRect = limitX!.getBoundingClientRect();

	// screen center of the ∞: the particle burst comes from there and the
	// cartesian plane emerges from there too (a growing circle). since
	// #limit-infinity-shake hangs off #limit-block (fixed), its rect is
	// already viewport-relative and doesn't move during the pin. we convert
	// it to viewport % for the grid's clip-path, which fills the whole
	// screen during the pin.
	const infRect = limitInfinityShake!.getBoundingClientRect();
	const infCenterX = infRect.left + infRect.width / 2;
	const infCenterY = infRect.top + infRect.height / 2;
	const infXPct = (infCenterX / window.innerWidth) * 100;
	const infYPct = (infCenterY / window.innerHeight) * 100;

	// the formed title ("89K+ Raids bloqueados") lands right below the
	// "lim / x → ∞" block, left-aligned with it. limitBlock's rect is
	// already final (only its opacity is animated, which doesn't affect
	// layout).
	const limitBlockRect = limitBlock!.getBoundingClientRect();
	const titleLeft = limitBlockRect.left;
	const titleTop = limitBlockRect.bottom + 28;

	// centers of the radar and the limit block: the ∞'s shockwave
	// "disintegrates" them too, so some burst particles spawn from there
	// (not only from the ∞) and those elements get thrown outward.
	const radarRect = radarWrapper!.getBoundingClientRect();
	const radarCenterX = radarRect.left + radarRect.width / 2;
	const radarCenterY = radarRect.top + radarRect.height / 2 - 70; // ~adjustment for act 1's offset
	const limitCenterX = limitBlockRect.left + limitBlockRect.width / 2;
	const limitCenterY = limitBlockRect.top + limitBlockRect.height / 2;

	// origin of each particle: ~3/5 from the ∞, ~1/5 from the radar, ~1/5 from the limit.
	const burstOriginOf = (i: number) => {
		if (i % 5 === 0) return { x: radarCenterX, y: radarCenterY };
		if (i % 5 === 1) return { x: limitCenterX, y: limitCenterY };
		return { x: infCenterX, y: infCenterY };
	};
	burstDots.forEach((dot, i) => {
		const o = burstOriginOf(i);
		gsap.set(dot, { left: o.x, top: o.y, xPercent: -50, yPercent: -50, opacity: 0 });
	});

	// destinations of each piece as the title forms: the number on the left
	// and the label right next to it (using the number's final-size
	// width). LABEL_BASELINE_NUDGE fine-tunes the number/label vertical
	// alignment.
	const LABEL_GAP = 12;
	const LABEL_BASELINE_NUDGE = 0;
	const numberTargetLeft = titleLeft;
	const numberTargetTop = titleTop;
	const labelTargetLeft = titleLeft + numberRestRect.width + LABEL_GAP;
	const labelTargetTop = titleTop + LABEL_BASELINE_NUDGE;
	// when "89K+" leaves to occupy the "x", the label (now "Raids
	// bloqueados = x") repositions CENTERED against the "lim" block: the
	// whole group's center matches the limit's center.
	const labelReflowLeft = limitBlockRect.left + limitBlockRect.width / 2 - labelFullWidth / 2;

	// final position of the number, centered over the limit's "x". once it
	// gets there it shrinks to NUMBER_ON_X_SIZE to fit inside the "x"'s gap
	// without overflowing it; we center using its ALREADY-shrunk
	// dimensions (the box contracts toward its top-left corner, which is
	// the left/top anchor).
	const NUMBER_ON_X_SIZE = 22;
	// "89K+" ended up sitting a touch above where the "x" was: we nudge it
	// down a bit with this offset (px, positive = further down).
	const NUMBER_ON_X_NUDGE_Y = 6;
	const numberOnXRatio = NUMBER_ON_X_SIZE / titleFontSize;
	const numberFinalLeft = xRect.left + xRect.width / 2 - (numberRestRect.width * numberOnXRatio) / 2;
	const numberFinalTop =
		xRect.top + xRect.height / 2 - (numberRestRect.height * numberOnXRatio) / 2 + NUMBER_ON_X_NUDGE_Y;
	return {
		STATS_TOP_REST,
		curveLength,
		raidsTarget,
		numberRestRect,
		labelRestRect,
		titleFontSize,
		raidsEqx,
		xRect,
		infCenterX,
		infCenterY,
		infXPct,
		infYPct,
		radarCenterX,
		radarCenterY,
		limitCenterX,
		limitCenterY,
		numberTargetLeft,
		numberTargetTop,
		labelTargetLeft,
		labelTargetTop,
		labelReflowLeft,
		numberFinalLeft,
		numberFinalTop,
		NUMBER_ON_X_SIZE,
	};
}

export type Measurements = ReturnType<typeof prepareScene>;
