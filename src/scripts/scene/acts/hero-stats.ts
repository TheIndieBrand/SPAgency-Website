// act 1: the hero fades out and the stats rise and count up to their value.
import type { SceneRefs } from "../dom";
import type { Measurements } from "../prepare";

export function addHeroStatsAct(tl: gsap.core.Timeline, r: SceneRefs, m: Measurements) {
	const {
		navbar,
		heroTitle,
		heroSubtitle,
		heroActions,
		radarWrapper,
		radarPlane,
		statsSection,
		statNumbers,
	} = r;
	const { STATS_TOP_REST } = m;
	// the header fades out as soon as scroll starts and never reappears for
	// the rest of the scene (nothing touches it again after this stretch) —
	// it's taken out of circulation for clicks too, not just visually.
	tl.to(navbar, { opacity: 0, y: -16, duration: 1.2, ease: "power1.inOut" }, 0).set(
		navbar,
		{ pointerEvents: "none" },
		1.2,
	);

	// the subtitle and buttons fade out gradually (spanning a good chunk of
	// the scroll, not an abrupt cut) — by the end only the title, the
	// background math letters, and the radar remain.
	tl.to([heroSubtitle, heroActions], { opacity: 0, y: -16, duration: 2.2, ease: "power1.inOut" }, 0)
		// the title drops down a bit (instead of rising flush with the
		// radar) so it stays better centered in the space the
		// subtitle/buttons leave as they fade, rather than sitting stuck to
		// the hero's top.
		.to(heroTitle, { y: 50, duration: 3, ease: "power1.inOut" }, 0)
		// the radar rises and shrinks a little to make room for the stats
		// instead of staying flush against the title.
		.to(radarWrapper, { y: -70, scale: 0.94, duration: 3, ease: "power1.inOut" }, 0)
		// the radar's rotation changes over the whole scroll.
		.to(radarPlane, { rotationZ: 15, rotationX: 72, duration: 3, ease: "none" }, 0)
		// the stats rise and settle a bit past center (`top` is animated,
		// not a transform — see statsSection's initial gsap.set).
		.to(statsSection, { top: STATS_TOP_REST, opacity: 1, duration: 2, ease: "power2.out" }, 0.8);

	// each number counts from 0 to its real value as the stats finish settling.
	statNumbers.forEach((el) => {
		const target = parseFloat(el.dataset.target || "0");
		const decimals = parseInt(el.dataset.decimals || "0", 10);
		const prefix = el.dataset.prefix || "";
		const suffix = el.dataset.suffix || "";
		const counter = { val: 0 };

		tl.to(
			counter,
			{
				val: target,
				duration: 1.2,
				ease: "power1.out",
				onUpdate: () => {
					el.textContent = `${prefix}${counter.val.toFixed(decimals)}${suffix}`;
				},
			},
			1.7,
		);
	});
}
