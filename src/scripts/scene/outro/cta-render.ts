// renders the final cta piece by piece (title word by word, text, buttons
// and recap), as a function of the time since CTA_AT.
import { gsap } from "gsap";
import { smoothstep01 } from "./camera";

export function createCtaRenderer(ctaSceneEl: HTMLElement) {
	const ctaWords = [...ctaSceneEl.querySelectorAll<HTMLElement>("[data-cta-word]")];
	const ctaSub = ctaSceneEl.querySelector<HTMLElement>("[data-cta-sub]");
	const ctaButtons = ctaSceneEl.querySelector<HTMLElement>("[data-cta-buttons]");
	const ctaRecapItems = [...ctaSceneEl.querySelectorAll<HTMLElement>("[data-cta-recap-item]")];
	const ctaRecapLines = [...ctaSceneEl.querySelectorAll<HTMLElement>("[data-cta-recap-line]")];
	const ctaRings = [...ctaSceneEl.querySelectorAll<SVGCircleElement>("[data-cta-ring]")];
	const ctaChecks = [...ctaSceneEl.querySelectorAll<SVGPathElement>("[data-cta-check]")];
	const RING_LEN = 62.83;
	// exit bounce for the main button (easeOutBack).
	const outBack = (k: number) => {
		const c1 = 1.9;
		const c3 = c1 + 1;
		return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2);
	};
	// the cta is composed piece by piece, each with its own delay (in
	// timeline units since CTA_AT): title word by word, text, buttons, recap.
	// (starts as true so the first render leaves every piece hidden.)
	let ctaAnimated = true;
	const renderCta = (ctaT: number) => {
		if (ctaT <= 0 && !ctaAnimated) return;
		ctaAnimated = ctaT > 0;
		const at = (delay: number, dur: number) => smoothstep01((ctaT - delay) / dur);
		ctaWords.forEach((w, i) => {
			const p = at(i * 0.11, 0.75);
			gsap.set(w, { opacity: p, y: (1 - p) * 26, filter: p < 1 ? `blur(${(1 - p) * 12}px)` : "none" });
		});
		const subP = at(0.85, 0.7);
		if (ctaSub) gsap.set(ctaSub, { opacity: subP, y: (1 - subP) * 16 });
		const btnRaw = Math.min(Math.max((ctaT - 1.1) / 0.8, 0), 1);
		if (ctaButtons) {
			gsap.set(ctaButtons, {
				opacity: smoothstep01(btnRaw * 1.6),
				y: (1 - outBack(btnRaw)) * 34,
				scale: btnRaw === 0 ? 0.92 : 0.92 + 0.08 * outBack(btnRaw),
			});
		}
		ctaRecapItems.forEach((el, i) => {
			const p = at(1.6 + i * 0.25, 0.6);
			gsap.set(el, { opacity: p, y: (1 - p) * 12 });
			const ring = at(1.75 + i * 0.25, 0.7);
			ctaRings[i]?.setAttribute("stroke-dashoffset", String(RING_LEN * (1 - ring)));
			ctaChecks[i]?.setAttribute("opacity", String(smoothstep01((ring - 0.7) / 0.3)));
		});
		ctaRecapLines.forEach((el, i) => {
			gsap.set(el, { opacity: at(1.9 + i * 0.25, 0.3), scaleX: at(1.9 + i * 0.25, 0.5) });
		});
		return btnRaw;
	};

	return renderCta;
}
