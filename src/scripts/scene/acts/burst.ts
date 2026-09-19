// Desenlace: el ∞ estalla, emerge el plano cartesiano.
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
	// ================= DESENLACE (el título ya está sobre la "x") =============

	// El "89K+" se dispara: cuenta desde 89K hacia un número titánico, cada vez
	// más rápido (power2.in), recentrándose sobre la "x" a cada frame para que
	// no se descuadre al ensancharse. Mismo mecanismo que el contador de stats.
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
		// La flecha "⟶" se apaga para dejarle sitio al número que se ensancha.
		.to(limitArrow, { opacity: 0, duration: 0.8, ease: "power1.out" }, 7.6);

	// El ∞ empieza a temblar PRONTO y cada vez más fuerte (la animación CSS ya
	// corre; aquí solo subimos su amplitud de 0 a 1) — es el "cargando" largo
	// antes de estallar.
	tl.to(limitInfinityShake, { "--tremble": 1, duration: 2.6, ease: "power2.in" }, 7.4);

	// ---- ¡EL ∞ ESTALLA! (pos 10.0) ----
	// El ∞ desaparece y su onda expansiva se lleva por delante el radar, el
	// bloque del límite y el título "89K+ Raids bloqueados": salen despedidos y
	// se desintegran en partículas que se arrastran hacia fuera. Solo queda el
	// plano cartesiano emergiendo (y los símbolos tenues del fondo).
	const burstReach = Math.hypot(window.innerWidth, window.innerHeight);

	// 1. El ∞ desaparece de golpe.
	tl.to(limitInfinityShake, { opacity: 0, duration: 0.12, ease: "none" }, BURST_POS);

	// 2. Las partículas salen disparadas desde su origen (∞ / radar / límite).
	//    Las del ∞ vuelan lejos y rápido (cruzan el borde); las del radar y el
	//    límite van algo más lentas y cortas, para que "se arrastren".
	burstDots.forEach((dot, i) => {
		const fromInf = i % 5 >= 2;
		const angle = i * 2.399963 + (i % 3) * 0.5; // reparto tipo "girasol"
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

	// 3. Radar, límite y título salen despedidos en la dirección contraria al ∞,
	//    encogiéndose, girando y desvaneciéndose (como si la onda los rompiera).
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

	// 4. De ese punto estallado emerge el plano cartesiano: un círculo que crece
	//    DESDE el ∞ (infX/Y %) hasta cubrir la pantalla. Progresivo (power2.out,
	//    ~2s) para que se vea crecer, no aparecer de golpe. Nada más se
	//    desvanece: el plano se queda y se lo lleva el scroll normal al
	//    despinearse.
	tl.fromTo(
		asymptoteGrid,
		{ clipPath: `circle(0% at ${infXPct}% ${infYPct}%)` },
		{ clipPath: `circle(175% at ${infXPct}% ${infYPct}%)`, duration: 2, ease: "power2.out" },
		BURST_POS + 0.18,
	);
}
