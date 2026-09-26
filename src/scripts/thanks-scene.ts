// /gracias scene. a black hole (the same <BlackHole />) fills the screen; on
// scroll the camera orbits it, the bot's logo emerges from the event horizon
// and the hole retreats to a corner as the headline appears. afterward, with
// the stage settled, the hole keeps slowly spinning in the background while the steps are read.
//
// only runs if the <head> set data-thanks="on" (no "reduce motion"); without
// that the page is static and all the content sits in normal flow.
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const Nav = 73; // top bar height
const Base = 640; // the hole's canvas side (css px), the `size` given to it on the page
const StartYaw = 2.94; // = BlackHole.astro's DefaultYaw

function mount() {
	const el = (id: string) => document.getElementById(id)!;
	const hero = el("t-hero");
	const rest = el("t-rest");
	const bh = el("t-bh-inner");
	const logo = el("t-logo");
	const headline = el("t-headline");
	const intro = [el("t-eyebrow"), el("t-hint")];
	const canvas = bh.querySelector<HTMLCanvasElement>("canvas[data-blackhole]");
	if (!hero || !rest || !bh || !canvas) return;

	const vw = () => window.innerWidth;
	const stageH = () => window.innerHeight - Nav;
	const small = () => vw() < 768;

	// hole sizes: full (fills the screen) and collapsed (a corner).
	const full = () => Math.min(vw() * 1.05, stageH() * 1.2) / Base;
	const corner = () => full() * (small() ? 0.44 : 0.38);

	// the hole's camera: this object is animated and every change is sent to the canvas.
	const orbit = { yaw: StartYaw, pitch: 0.36, dist: 30 };
	const push = () => canvas.dispatchEvent(new CustomEvent("blackhole:orbit", { detail: { ...orbit } }));
	push();

	gsap.set(bh, { xPercent: -50, yPercent: -50, transformOrigin: "50% 50%" });
	gsap.set([logo, headline], { xPercent: -50, yPercent: -50 });

	const logoY = () => -(small() ? 0.23 : 0.16) * stageH();
	const headlineY = () => (small() ? 0.15 : 0.13) * stageH();

	// ── stage 1: the fixed stage (the hero is 380vh tall and its content is sticky) ──
	const heroTl = gsap
		.timeline({
			defaults: { ease: "none" },
			scrollTrigger: {
				trigger: hero,
				start: `top ${Nav}px`,
				end: "bottom bottom",
				scrub: 1,
				invalidateOnRefresh: true,
			},
		})
		// the hole fills the screen and the camera starts orbiting it.
		.fromTo(bh, { x: 0, y: 0, scale: () => full() }, { scale: () => full() * 1.12, duration: 3.5 }, 0)
		.to(orbit, { yaw: StartYaw + 1.2, pitch: 0.3, dist: 26, duration: 3.5, onUpdate: push }, 0)
		.to(intro, { opacity: 0, y: -12, duration: 1 }, 0.4)
		// the hole retreats to the top-right corner and, at the same time, the
		// logo emerges from the center of its shadow and rises into place (same moment, same curve).
		.to(
			bh,
			{
				x: () => (small() ? 0.24 : 0.3) * vw(),
				y: () => -0.28 * stageH(),
				scale: () => corner(),
				duration: 3,
				ease: "power2.inOut",
			},
			3.5,
		)
		.fromTo(
			logo,
			{ opacity: 0, scale: 0.4, filter: "blur(14px)", y: 0 },
			{ opacity: 1, filter: "blur(0px)", duration: 1.6, ease: "power2.out" },
			3.5,
		)
		.to(logo, { y: () => logoY(), scale: 0.85, duration: 3, ease: "power2.inOut" }, 3.5)
		.to(orbit, { yaw: StartYaw + 2.6, pitch: 0.15, dist: 30, duration: 6.5, onUpdate: push }, 3.5)
		.fromTo(
			headline,
			{ opacity: 0, y: () => headlineY() + 30 },
			{ opacity: 1, y: () => headlineY(), duration: 1.6, ease: "power2.out" },
			5.2,
		)
		// a breather with the headline on screen before releasing the stage.
		.to({}, { duration: 1.5 }, 8.5);

	// ── stage 2: the stage leaves and the hole keeps spinning in the background ──
	const restTl = gsap
		.timeline({
			defaults: { ease: "none" },
			scrollTrigger: {
				trigger: rest,
				start: "top bottom",
				end: "bottom bottom",
				scrub: 1,
				invalidateOnRefresh: true,
			},
		})
		.to(bh, { y: () => -0.28 * stageH() - 0.16 * window.innerHeight, opacity: 0.5, duration: 1 }, 0)
		.to(orbit, { yaw: StartYaw + 5, duration: 1, onUpdate: push }, 0);

	// development only: lets progress be pinned by hand to review the scene without scrolling.
	if (import.meta.env.DEV) Object.assign(window, { __thanks: { heroTl, restTl, ScrollTrigger } });

	// ── steps: the line fills in as it progresses and each step lights up on arrival ──
	gsap.to("#t-rail-fill", {
		scaleY: 1,
		ease: "none",
		scrollTrigger: { trigger: "#t-steps", start: "top 65%", end: "bottom 60%", scrub: true },
	});
	ScrollTrigger.batch(".t-step", {
		start: "top 75%",
		once: true,
		onEnter: (items) => items.forEach((item) => item.classList.add("is-on")),
	});
}

if (document.documentElement.dataset.thanks === "on") mount();
