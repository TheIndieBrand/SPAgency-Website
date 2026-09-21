// Escena de /gracias. Un agujero negro (el mismo <BlackHole />) llena la pantalla; al
// hacer scroll la cámara lo orbita, del horizonte de sucesos emerge el logo del bot y el
// agujero se aparta a una esquina mientras aparece el titular. Después, ya con el
// escenario suelto, el agujero sigue girando despacio al fondo mientras se leen los pasos.
//
// Solo corre si el <head> puso data-thanks="on" (no hay «reducir movimiento»); sin eso
// la página es estática y todo el contenido está en el flujo normal.
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const NAV = 73; // alto de la barra superior
const BASE = 640; // lado del canvas del agujero (px CSS), el `size` que se le da en la página
const START_YAW = 2.94; // = DEFAULT_YAW de BlackHole.astro

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
	const stageH = () => window.innerHeight - NAV;
	const small = () => vw() < 768;

	// Tamaños del agujero: lleno (llena la pantalla) y recogido (una esquina).
	const full = () => Math.min(vw() * 1.05, stageH() * 1.2) / BASE;
	const corner = () => full() * (small() ? 0.44 : 0.38);

	// Cámara del agujero: se anima este objeto y cada cambio se le manda al canvas.
	const orbit = { yaw: START_YAW, pitch: 0.36, dist: 30 };
	const push = () => canvas.dispatchEvent(new CustomEvent("blackhole:orbit", { detail: { ...orbit } }));
	push();

	gsap.set(bh, { xPercent: -50, yPercent: -50, transformOrigin: "50% 50%" });
	gsap.set([logo, headline], { xPercent: -50, yPercent: -50 });

	const logoY = () => -(small() ? 0.23 : 0.16) * stageH();
	const headlineY = () => (small() ? 0.15 : 0.13) * stageH();

	// ── Tramo 1: el escenario fijo (el hero mide 380vh y su contenido va sticky) ──
	const heroTl = gsap
		.timeline({
			defaults: { ease: "none" },
			scrollTrigger: {
				trigger: hero,
				start: `top ${NAV}px`,
				end: "bottom bottom",
				scrub: 1,
				invalidateOnRefresh: true,
			},
		})
		// El agujero llena la pantalla y la cámara empieza a girar a su alrededor.
		.fromTo(bh, { x: 0, y: 0, scale: () => full() }, { scale: () => full() * 1.12, duration: 3.5 }, 0)
		.to(orbit, { yaw: START_YAW + 1.2, pitch: 0.3, dist: 26, duration: 3.5, onUpdate: push }, 0)
		.to(intro, { opacity: 0, y: -12, duration: 1 }, 0.4)
		// El agujero se recoge a la esquina de arriba a la derecha y, a la vez, del centro
		// de su sombra emerge el logo y sube a su sitio (mismo instante, misma curva).
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
		.to(orbit, { yaw: START_YAW + 2.6, pitch: 0.15, dist: 30, duration: 6.5, onUpdate: push }, 3.5)
		.fromTo(
			headline,
			{ opacity: 0, y: () => headlineY() + 30 },
			{ opacity: 1, y: () => headlineY(), duration: 1.6, ease: "power2.out" },
			5.2,
		)
		// Un respiro con el titular en pantalla antes de soltar el escenario.
		.to({}, { duration: 1.5 }, 8.5);

	// ── Tramo 2: el escenario se va y el agujero sigue girando al fondo ──
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
		.to(orbit, { yaw: START_YAW + 5, duration: 1, onUpdate: push }, 0);

	// Solo en desarrollo: permite fijar el progreso a mano para revisar la escena sin hacer scroll.
	if (import.meta.env.DEV) Object.assign(window, { __thanks: { heroTl, restTl, ScrollTrigger } });

	// ── Pasos: la línea se rellena al avanzar y cada paso se enciende al llegar ──
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
