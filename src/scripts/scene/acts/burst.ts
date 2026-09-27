// finale: the ∞ bursts, the cartesian plane emerges.
import { gsap } from "gsap";
import type { SceneRefs } from "../dom";
import type { Measurements } from "../prepare";
import { BURST_POS } from "../timing";

export function addBurstAct(tl: gsap.core.Timeline, r: SceneRefs, m: Measurements) {
	const {
		radarWrapper,
		raidsNumber,
		raidsLabel,
		asymptoteGrid,
		limitBlock,
		limitArrow,
		limitInfinityShake,
		burstDots,
	} = r;
	const {
		raidsTarget,
		xRect,
		infCenterX,
		infCenterY,
		infXPct,
		infYPct,
		radarCenterX,
		radarCenterY,
		limitCenterX,
		limitCenterY,
	} = m;
	// ================= FINALE (the title is already over the "x") =============

	// "89K+" shoots up: counts from 89K toward a titanic number, faster and
	// faster (power2.in), recentering over the "x" every frame so it
	// doesn't drift as it widens. same mechanism as the stats counter.
	const fmtTitanic = (n: number): string => {
		if (n >= 1_000_000) return `${+(n / 1_000_000).toFixed(1)}B+`;
		if (n >= 1_000) return `${+(n / 1_000).toFixed(1)}M+`;
		return `${Math.round(n)}K+`;
	};
	const xCenterX = xRect.left + xRect.width / 2;
	const titanicCounter = { k: raidsTarget };
	tl.to(
		titanicCounter,
		{
			k: 8_800_000,
			duration: 2.2,
			ease: "power2.in",
			onUpdate: () => {
				raidsNumber!.textContent = fmtTitanic(titanicCounter.k);
				gsap.set(raidsNumber!, {
					left: xCenterX - raidsNumber!.getBoundingClientRect().width / 2,
				});
			},
		},
		7.6,
	)
		// the "⟶" arrow fades out to make room for the widening number.
		.to(limitArrow, { opacity: 0, duration: 0.8, ease: "power1.out" }, 7.6);

	// the ∞ starts trembling EARLY and gets stronger over time (the css
	// animation is already running; here we just raise its amplitude from
	// 0 to 1) — it's the long "charging up" before the burst.
	tl.to(limitInfinityShake, { "--tremble": 1, duration: 2.6, ease: "power2.in" }, 7.4);

	// ---- THE ∞ BURSTS! (pos 10.0) ----
	// the ∞ disappears and its shockwave sweeps away the radar, the limit
	// block and the "89K+ Raids bloqueados" title: they get thrown outward
	// and disintegrate into particles that drag off-screen. only the
	// cartesian plane remains, emerging (plus the faint background symbols).
	const burstReach = Math.hypot(window.innerWidth, window.innerHeight);

	// 1. the ∞ disappears in an instant.
	tl.to(limitInfinityShake, { opacity: 0, duration: 0.12, ease: "none" }, BURST_POS);

	// 2. particles shoot out from their origin (∞ / radar / limit). the
	//    ones from the ∞ fly far and fast (crossing the edge); the ones
	//    from the radar and the limit are a bit slower and shorter, so
	//    they read as "dragging" out.
	burstDots.forEach((dot, i) => {
		const fromInf = i % 5 >= 2;
		const angle = i * 2.399963 + (i % 3) * 0.5; // "sunflower"-style distribution
		const reach = fromInf
			? burstReach * (0.6 + ((i * 3) % 12) / 18)
			: burstReach * (0.3 + ((i * 5) % 10) / 26);
		const travel = fromInf ? 1.6 : 2.3;
		const at = BURST_POS + i * 0.012;
		tl.to(dot, { opacity: fromInf ? 1 : 0.85, duration: 0.1, ease: "none" }, at)
			.to(
				dot,
				{
					x: Math.cos(angle) * reach,
					y: Math.sin(angle) * reach,
					rotation: "random(-90, 90)",
					duration: travel,
					ease: fromInf ? "power3.out" : "power2.out",
				},
				at,
			)
			.to(
				dot,
				{ opacity: 0, duration: fromInf ? 0.7 : 1.2, ease: "power1.in" },
				at + (fromInf ? 0.7 : 0.9),
			);
	});

	// 3. the radar, limit and title get thrown off in the direction opposite
	//    the ∞, shrinking, spinning and fading out (as if the wave broke them).
	const flingAway = (el: Element | Element[], cx: number, cy: number, dist: number) => {
		const dx = cx - infCenterX;
		const dy = cy - infCenterY;
		const len = Math.hypot(dx, dy) || 1;
		tl.to(
			el,
			{
				x: `+=${((dx / len) * dist).toFixed(1)}`,
				y: `+=${((dy / len) * dist).toFixed(1)}`,
				rotation: "random(-14, 14)",
				scale: 0.8,
				opacity: 0,
				duration: 1.1,
				ease: "power2.in",
			},
			BURST_POS + 0.04,
		);
	};
	flingAway(radarWrapper!, radarCenterX, radarCenterY, 380);
	flingAway(limitBlock!, limitCenterX, limitCenterY, 300);
	flingAway([raidsNumber!, raidsLabel!], limitCenterX, limitCenterY, 320);

	// 4. from that burst point the cartesian plane emerges: a circle
	//    growing FROM the ∞ (infX/Y %) until it covers the screen.
	//    gradual (power2.out, ~2s) so it reads as growing, not popping in.
	//    nothing else fades: the plane stays and normal scroll carries it
	//    off once the pin releases.
	tl.fromTo(
		asymptoteGrid,
		{ clipPath: `circle(0% at ${infXPct}% ${infYPct}%)` },
		{ clipPath: `circle(175% at ${infXPct}% ${infYPct}%)`, duration: 2, ease: "power2.out" },
		BURST_POS + 0.18,
	);
}
