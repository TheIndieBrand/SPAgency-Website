// Campo de estrellas INFINITO del fondo de la escena de entrada, dibujado en un
// <canvas> 2D. Sustituye a las ~800 <span> que había antes: esas solo cubrían
// un rectángulo finito (había que dimensionarlo a mano para todo el recorrido
// de la cámara y no aguantaba más descenso). Aquí las estrellas se repiten en
// mosaico, así que la cámara puede ir tan lejos como haga falta, y además
// permite zoom y líneas de velocidad sin bordes ni coste extra.
//
// El estado que ya animaban los tweens de GSAP (opacidad y `y` de bajada
// durante el ascenso) vive en un elemento "controlador" invisible: aquí solo
// se LEE con gsap.getProperty, así esos tweens no han cambiado. La cámara
// llega por setCamera(), con un zoom opcional respecto al centro de la pantalla
// (la escena hace zoom out / zoom in en los pasos finales). Las estrellas son
// lejanas: siguen solo la mitad del zoom (paralaje) y no cambian de tamaño.
import { gsap } from "gsap";

const TILE_W = 1600;
const TILE_H = 1200;
// ~41 estrellas por pantalla de 1280×800, como tenía el campo original.
const STARS_PER_TILE = 77;
const TWINKLE_PERIOD = 3.6; // s
const TWINKLE_DEPTH = 0.65; // el parpadeo lleva la opacidad a 35% de la base

interface Star {
	x: number;
	y: number;
	size: number;
	alpha: number;
	phase: number; // solo parpadean 1 de cada 3 (twinkle = true)
	twinkle: boolean;
}

// PRNG determinista: el mismo cielo en cada carga y en cada teselado.
function mulberry32(seed: number) {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function makeTile(): Star[] {
	const rand = mulberry32(0x5eed);
	return Array.from({ length: STARS_PER_TILE }, (_, i) => ({
		x: rand() * TILE_W,
		y: rand() * TILE_H,
		size: 1 + Math.floor(rand() * 3),
		alpha: 0.35 + rand() * 0.45,
		phase: rand() * Math.PI * 2,
		twinkle: i % 3 === 0,
	}));
}

export function createStarField(canvas: HTMLCanvasElement, controller: HTMLElement) {
	const ctx = canvas.getContext("2d");
	if (!ctx) return { setCamera: (_x: number, _y: number, _z?: number) => {}, destroy: () => {} };

	const tile = makeTile();
	let camX = 0;
	let camY = 0;
	let zoom = 1;
	let cssW = 0;
	let cssH = 0;

	const resize = () => {
		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		cssW = canvas.clientWidth;
		cssH = canvas.clientHeight;
		canvas.width = Math.max(1, Math.round(cssW * dpr));
		canvas.height = Math.max(1, Math.round(cssH * dpr));
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	};
	resize();
	const observer = new ResizeObserver(resize);
	observer.observe(canvas);

	const draw = () => {
		ctx.clearRect(0, 0, cssW, cssH);
		const opacity = Number(gsap.getProperty(controller, "opacity")) || 0;
		if (opacity <= 0.005) return;

		// Los tweens del ascenso bajan las estrellas `ascent` px: equivale a que
		// la cámara esté `ascent` px más arriba en el mundo.
		const ascent = Number(gsap.getProperty(controller, "y")) || 0;
		const ox = camX;
		const oy = camY - ascent;
		const time = performance.now() / 1000;

		// Zoom respecto al centro de la pantalla (medio zoom: paralaje). Con zoom < 1
		// se ve más mundo, así que el rango de teselas a recorrer crece 1/zs.
		const zs = 1 + (zoom - 1) * 0.5;
		const cx = cssW / 2;
		const cy = cssH / 2;
		const minX = ox + cx - cx / zs;
		const maxX = ox + cx + (cssW - cx) / zs;
		const minY = oy + cy - cy / zs;
		const maxY = oy + cy + (cssH - cy) / zs;

		ctx.fillStyle = "#ffffff";
		const i0 = Math.floor(minX / TILE_W);
		const j0 = Math.floor(minY / TILE_H);
		for (let i = i0; i * TILE_W < maxX; i++) {
			for (let j = j0; j * TILE_H < maxY; j++) {
				const bx = i * TILE_W;
				const by = j * TILE_H;
				for (let s = 0; s < tile.length; s++) {
					const star = tile[s];
					const x = cx + (bx + star.x - ox - cx) * zs;
					const y = cy + (by + star.y - oy - cy) * zs;
					if (x < -3 || x > cssW || y < -3 || y > cssH) continue;
					let a = star.alpha;
					if (star.twinkle) {
						const k = 0.5 + 0.5 * Math.cos((time * Math.PI * 2) / TWINKLE_PERIOD + star.phase);
						a *= 1 - TWINKLE_DEPTH * (1 - k);
					}
					ctx.globalAlpha = a * opacity;
					ctx.fillRect(x, y, star.size, star.size);
				}
			}
		}
		ctx.globalAlpha = 1;
	};
	gsap.ticker.add(draw);

	return {
		setCamera(x: number, y: number, z = 1) {
			camX = x;
			camY = y;
			zoom = z;
		},
		destroy() {
			gsap.ticker.remove(draw);
			observer.disconnect();
		},
	};
}
