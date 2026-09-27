// INFINITE star field for the intro scene's background, drawn on a 2d
// <canvas>. replaces the ~800 <span>s there used to be: those only covered a
// finite rectangle (it had to be sized by hand for the camera's whole
// journey and couldn't take any more descent). here stars repeat as a tile,
// so the camera can go as far as needed, and it also allows zoom and speed
// lines with no edges or extra cost.
//
// the state gsap's tweens already animate (opacity and the descending `y`
// during the ascent) lives on an invisible "controller" element: this only
// READS it via gsap.getProperty, so those tweens stay untouched. the camera
// arrives via setCamera(), with an optional zoom relative to the screen's
// center (the scene zooms out / in during the final steps). stars are far
// away: they only follow half the zoom (parallax) and don't change size.
import { gsap } from "gsap";

const TileW = 1600;
const TileH = 1200;
// ~41 stars per 1280×800 screen, same as the original field.
const StarsPerTile = 77;
const TwinklePeriod = 3.6; // s
const TwinkleDepth = 0.65; // the flicker takes opacity down to 35% of its base

interface Star {
	x: number;
	y: number;
	size: number;
	alpha: number;
	phase: number; // only 1 in 3 flicker (twinkle = true)
	twinkle: boolean;
}

// deterministic prng: the same sky on every load and every tile.
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
	return Array.from({ length: StarsPerTile }, (_, i) => ({
		x: rand() * TileW,
		y: rand() * TileH,
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

		// the ascent tweens move the stars down `ascent` px: equivalent to the
		// camera being `ascent` px higher in the world.
		const ascent = Number(gsap.getProperty(controller, "y")) || 0;
		const ox = camX;
		const oy = camY - ascent;
		const time = performance.now() / 1000;

		// zoom relative to the screen's center (half zoom: parallax). with zoom
		// < 1 more of the world is visible, so the range of tiles to cover grows by 1/zs.
		const zs = 1 + (zoom - 1) * 0.5;
		const cx = cssW / 2;
		const cy = cssH / 2;
		const minX = ox + cx - cx / zs;
		const maxX = ox + cx + (cssW - cx) / zs;
		const minY = oy + cy - cy / zs;
		const maxY = oy + cy + (cssH - cy) / zs;

		ctx.fillStyle = "#ffffff";
		const i0 = Math.floor(minX / TileW);
		const j0 = Math.floor(minY / TileH);
		for (let i = i0; i * TileW < maxX; i++) {
			for (let j = j0; j * TileH < maxY; j++) {
				const bx = i * TileW;
				const by = j * TileH;
				for (let s = 0; s < tile.length; s++) {
					const star = tile[s];
					const x = cx + (bx + star.x - ox - cx) * zs;
					const y = cy + (by + star.y - oy - cy) * zs;
					if (x < -3 || x > cssW || y < -3 || y > cssH) continue;
					let a = star.alpha;
					if (star.twinkle) {
						const k = 0.5 + 0.5 * Math.cos((time * Math.PI * 2) / TwinklePeriod + star.phase);
						a *= 1 - TwinkleDepth * (1 - k);
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
