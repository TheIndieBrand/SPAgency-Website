// navbar links to sections that live INSIDE the scene (there's no dom anchor
// to jump to): they scroll to the point where that part of the animation is
// on screen. the destination is the timeline label with the same name as
// the href (`#features` -> label "features"; see timing.ts and mount.ts).
export function bindNavAnchors(tl: gsap.core.Timeline) {
	document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach((link) => {
		const label = (link.getAttribute("href") ?? "").slice(1);
		if (!(label in tl.labels)) return;
		link.addEventListener("click", (event) => {
			const st = tl.scrollTrigger;
			if (!st) return;
			event.preventDefault();
			window.scrollTo({ top: st.start + (tl.labels[label] / tl.duration()) * (st.end - st.start), behavior: "auto" });
		});
	});
}
