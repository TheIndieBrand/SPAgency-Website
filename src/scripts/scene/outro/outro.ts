// the final act as a world with a camera: the asymptote's trail, the star
// background, the steps, the black hole, the immersion, and the cta.
// renderOutro(t) paints everything from the time; layoutOutro()
// recalculates the measurements (on mount and on every resize).
import { gsap } from "gsap";
import type { SceneRefs } from "../dom";
import { createStarField } from "../../star-field";
import { createStepsAct, StepContactOffsets, StepRadius, wobble } from "../../steps-act";
import { createCamera, smoothstep01 } from "./camera";
import { createCtaRenderer } from "./cta-render";
import {
	OUTRO_LINE_AT,
	LINE_CENTER_AT,
	BLACKHOLE_START_OFFSET,
	BLACKHOLE_CROSS_DUR,
	BLACKHOLE_SPEED,
	OUTRO_END,
	OUTRO_TURN_END,
	OUTRO_CARDS_REST_AT,
	OUTRO_SETTLE_AT,
	OUTRO_SETTLE_DUR,
	OUTRO_TIP_CENTER_X,
	OUTRO_TIP_CENTER_Y,
	OUTRO_TIP_FINAL_X,
	OUTRO_TIP_FINAL_Y,
	CARD_FOCUS_SCALE,
	CARD_FOCUS_RADIUS_VH,
	BH_CENTER_AT,
	RUMBLE_START,
	RUMBLE_AMP,
	DIVE_START,
	DIVE_DUR,
	DIVE_END,
	DIVE_DIST_FAR,
	DIVE_DIST_NEAR,
	DIVE_PITCH_START,
	DIVE_PITCH_END,
	DIVE_BH_SCALE_END,
	DIVE_BLACK_AT,
	DIVE_BLACK_DONE,
	DIVE_RUMBLE_AMP,
	SPARK_AT,
	BLOOM_AT,
	BLOOM_DUR,
	CTA_AT,
	CTA_DUR,
} from "../timing";

export function createOutro(r: SceneRefs) {
	const {
		outroLine,
		outroPath,
		outroLineStar,
		outroStarLayer,
		outroWorld,
		routeDots,
		routeGrad,
		stepNodes,
		stepsWorld,
		diveVignette,
		diveBlack,
		diveBloom,
		diveSpark,
		ctaScene,
		community,
		communityWindow,
		communityTrack,
		outroBlackhole,
		outroBlackholeCanvas,
		spaceStars,
		spaceStarsCanvas,
	} = r;
	const { buildCamera, cameraAt, tipScreenAt, zoomAt } = createCamera();
	// "add your own": hangs off the track after the last card, but isn't a
	// card itself (doesn't count toward centering the last one or toward focus).
	const communityAction = communityTrack!.querySelector<HTMLElement>("[data-community-action]");
	// trail: the tip in WORLD coordinates (camera + on-screen position),
	// sampled over time and stored as a polyline; with the accumulated
	// length it's revealed via stroke-dashoffset up to wherever the tip is.
	const OUTRO_PATH_DT = 0.05;
	const outroPathEl = outroPath!;
	const outroGeo = {
		prepend: 0,
		total: 0,
		cum: new Float64Array(0),
		winTop: 0,
		winH: 0,
		cardsTurnEndY: 0,
		cardEls: [] as HTMLElement[],
		cardMids: new Float64Array(0), // center of each card inside the track
		lastMid: 0,
		bhWorldX: 0, // black hole's position in the world (part B)
		bhWorldY: 0,
	};
	const outroClock = { t: OUTRO_LINE_AT };
	// infinite star background: drawn by a canvas from the camera (and
	// from the opacity/descent state the tweens already animate on #space-stars).
	const starField = createStarField(spaceStarsCanvas!, spaceStars!);
	const outroWorldEl = outroWorld!;
	const routeDotsEl = routeDots!;
	const routeGradEl = routeGrad!;
	const outroLineEl = outroLine!;
	const outroStarLayerEl = outroStarLayer!;
	const stepsWorldEl = stepsWorld!;
	const diveVignetteEl = diveVignette!;
	const diveBlackEl = diveBlack!;
	const ctaSceneEl = ctaScene!;
	const ctaLinks = [...ctaSceneEl.querySelectorAll<HTMLAnchorElement>("a")];
	const ctaScrim = document.getElementById("cta-scene-scrim");
	const renderCta = createCtaRenderer(ctaSceneEl);
	// sends the fall's distance and angle to the black hole shader (only
	// when they change: renderOutro is called every frame).
	const lastDive = { dist: Number.NaN, pitch: Number.NaN };
	const sendDive = (dist: number, pitch: number) => {
		if (Math.abs(dist - lastDive.dist) < 1e-4 && Math.abs(pitch - lastDive.pitch) < 1e-5) return;
		lastDive.dist = dist;
		lastDive.pitch = pitch;
		outroBlackholeCanvas?.dispatchEvent(new CustomEvent("blackhole:orbit", { detail: { dist, pitch } }));
	};
	// the steps: path nodes in world coordinates (steps-act.ts). their
	// effects run in real time; requestRender repaints the scene at the
	// current instant when what changes isn't scroll but the shake or the star.
	const stepsAct = createStepsAct(stepNodes, () => renderOutro(outroClock.t));
	// black hole rumble: a CONTINUOUS, slight tremor (in real time, not
	// tied to scroll) whose volume grows from RUMBLE_START until the
	// black hole reaches the center. deterministic noise over the clock →
	// same character every time.
	// fall progress (0 → 1) and its accelerated version (power2.in: falls
	// faster and faster). the rumble climbs to DIVE_RUMBLE_AMP during the
	// fall and CUTS OUT sharply right before full black: the silence is
	// part of the effect.
	const diveU = (t: number) => Math.min(Math.max((t - DIVE_START) / DIVE_DUR, 0), 1);
	const diveK = (t: number) => diveU(t) ** 2;
	const rumbleAt = (t: number) => {
		const k = smoothstep01((t - RUMBLE_START) / (BH_CENTER_AT - RUMBLE_START));
		if (k <= 0) return { x: 0, y: 0 };
		const cut = 1 - smoothstep01((t - (DIVE_END - 0.4)) / 0.3);
		const amp = (RUMBLE_AMP * k + (DIVE_RUMBLE_AMP - RUMBLE_AMP) * diveK(t)) * cut;
		if (amp <= 0) return { x: 0, y: 0 };
		const now = performance.now() / 1000;
		return { x: amp * wobble(now, 3.1), y: amp * 0.8 * wobble(now, 8.3) };
	};
	const renderOutro = (t: number) => {
		const g = outroGeo;
		const W = window.innerWidth;
		const H = window.innerHeight;
		const rawCam = cameraAt(t);
		// camera shake from the impacts and the black hole's rumble: added
		// to the camera so the WHOLE world trembles (background, line, nodes) together.
		const rumble = rumbleAt(t);
		const shakeX = stepsAct.shake.x + rumble.x;
		const shakeY = stepsAct.shake.y + rumble.y;
		const cam = { x: rawCam.x + shakeX, y: rawCam.y + shakeY };
		const tip = tipScreenAt(t);
		// camera zoom relative to the screen's center (c): world → screen
		// is  c + (world − camera + settle − c) · zoom.
		const z = zoomAt(t);
		const cx = W / 2;
		const cy = H / 2;

		const u = Math.min(Math.max((t - OUTRO_LINE_AT) / OUTRO_PATH_DT, 0), g.cum.length - 1);
		const i = Math.min(Math.floor(u), g.cum.length - 2);
		const revealed = g.prepend + g.cum[i] + (g.cum[i + 1] - g.cum[i]) * (u - i);
		// finish: the whole asymptote (stroke and tip, as one block) shifts
		// from where it landed to the screen's center.
		const settle = smoothstep01((t - OUTRO_SETTLE_AT) / OUTRO_SETTLE_DUR);
		const dx = (OUTRO_TIP_CENTER_X - OUTRO_TIP_FINAL_X) * W * settle;
		const dy = (OUTRO_TIP_CENTER_Y - OUTRO_TIP_FINAL_Y) * H * settle;
		outroPathEl.style.strokeDashoffset = `${g.total - revealed}`;
		outroWorldEl.setAttribute(
			"transform",
			`translate(${cx} ${cy}) scale(${z}) translate(${-cam.x + dx - cx} ${-cam.y + dy - cy})`,
		);

		// the little star sits at the stroke's drawn end (since the shake
		// is already applied to the stroke, it needs to be subtracted
		// here). on touching the first step it's absorbed into the ring:
		// it sinks to its center while shrinking and fading out.
		const absorb = stepsAct.starAbsorb.k;
		gsap.set(outroLineStar, {
			x: cx + (tip.x + dx - shakeX - cx) * z,
			y: cy + (tip.y + dy - shakeY - cy) * z + StepRadius * absorb * z,
			scale: z * (1 - 0.85 * absorb),
			opacity: 1 - absorb,
		});

		starField.setCamera(cam.x, cam.y, z);

		// steps: world nodes; their "completed" state is a function of time.
		stepsAct.setTime(t - LINE_CENTER_AT);
		stepsAct.render({ W, H, camX: cam.x, camY: cam.y, dx, dy, zoom: z, cx, cy });

		// black hole. first its usual scripted crossing (same formula its
		// tweens used to have: enters from the right with its center on
		// the bottom edge and exits to the left). afterward, now as a
		// body of the world, it comes back from below: its position comes
		// from the camera and the zoom, so it peeks in with the zoom out
		// and rises to the center as the camera keeps descending.
		const bhStart = LINE_CENTER_AT + BLACKHOLE_START_OFFSET;
		let bhX: number;
		let bhY: number;
		let bhScale = 1;
		let bhOpacity = 1;
		if (t < bhStart + BLACKHOLE_CROSS_DUR) {
			const p = Math.min(Math.max((t - bhStart) / BLACKHOLE_CROSS_DUR, 0), 1);
			const fade = Math.min(Math.max((t - bhStart) / 1.8, 0), 1);
			bhX = W * (1.05 - 2.1 * p);
			bhY = H * 0.5;
			bhOpacity = 1 - (1 - fade) * (1 - fade);
		} else {
			bhX = cx + (g.bhWorldX - cam.x + dx - cx) * z - cx;
			bhY = cy + (g.bhWorldY - cam.y + dy - cy) * z - cy;
			// the zoom out (0.78) and, during the fall, growth until it covers the screen.
			bhScale = z + (DIVE_BH_SCALE_END - z) * diveK(t);
		}
		gsap.set(outroBlackhole, { x: bhX, y: bhY, scale: bhScale, opacity: bhOpacity });

		// ---- Part C: immersion and emergence into the cta ----
		const diveProgress = diveU(t);
		const kDive = diveK(t);
		// the black hole grows to cover the screen and its shader FALLS:
		// the camera distance decreases geometrically (constant zoom in
		// log scale) and the angle rises, looking more and more from above onto the disk.
		sendDive(
			DIVE_DIST_FAR * Math.pow(DIVE_DIST_NEAR / DIVE_DIST_FAR, kDive),
			DIVE_PITCH_START + (DIVE_PITCH_END - DIVE_PITCH_START) * kDive,
		);

		// the asymptote and the steps fade out as the fall starts. (the
		// stroke's entrance fade, which used to be a tween, also comes
		// from here: this way a single function owns those opacities.)
		const lineIn = Math.min(Math.max((t - OUTRO_LINE_AT) / 0.35, 0), 1);
		const diveFade = smoothstep01((diveProgress - 0.05) / 0.4);
		outroLineEl.style.opacity = String(lineIn * (1 - diveFade));
		outroStarLayerEl.style.opacity = String(lineIn * (1 - diveFade));
		stepsWorldEl.style.opacity = String(1 - diveFade);

		// vignette closing in and full black once inside.
		diveVignetteEl.style.opacity = String(0.7 * smoothstep01((diveProgress - 0.35) / 0.6));
		diveBlackEl.style.opacity = String(smoothstep01((t - DIVE_BLACK_AT) / (DIVE_BLACK_DONE - DIVE_BLACK_AT)));

		// from black: point of light → expansion → cta. the point fades
		// out inside the growing glow; the glow recedes and leaves the card.
		const sparkIn = smoothstep01((t - SPARK_AT) / 0.5);
		const bloomK = smoothstep01((t - BLOOM_AT) / BLOOM_DUR);
		const ctaP = smoothstep01((t - CTA_AT) / CTA_DUR);
		gsap.set(diveSpark, {
			opacity: sparkIn * (1 - smoothstep01((t - BLOOM_AT - 0.3) / 0.8)),
			scale: 1 + 0.6 * bloomK,
		});
		gsap.set(diveBloom, {
			opacity: smoothstep01((t - BLOOM_AT + 0.3) / 0.6) * (1 - 0.7 * ctaP),
			scale: 1 + 40 * bloomK,
		});
		if (ctaScrim) ctaScrim.style.opacity = String(ctaP);
		const btnProgress = renderCta(t - CTA_AT) ?? 0;
		const ctaLive = btnProgress > 0.6;
		ctaSceneEl.style.opacity = "1";
		ctaSceneEl.style.pointerEvents = ctaLive ? "auto" : "none";
		for (const a of ctaLinks) a.tabIndex = ctaLive ? 0 : -1;

		// cards: they belong to the world, so they rise as much as the
		// camera descends once the turn ends (at the same speed as the
		// background). the track starts right below the window and
		// settles with the last card CENTERED on screen (so all of them,
		// the last included, pass through the center and gain focus).
		const yRest = H * 0.5 - g.winTop - g.lastMid;
		const travelled = Math.max(0, cam.y - g.cardsTurnEndY);
		const trackY = Math.max(yRest, g.winH - travelled);
		gsap.set(communityTrack, { y: trackY });

		// only clickable (and focusable) while the carousel is visible: as
		// with the final cta, an interactive element inside the scene
		// shouldn't receive clicks or tab focus once it's out of view.
		if (communityAction) {
			const actionLive = Number(gsap.getProperty(community, "opacity")) > 0.5;
			communityAction.style.pointerEvents = actionLive ? "auto" : "none";
			communityAction.tabIndex = actionLive ? 0 : -1;
		}

		// focus: scales based on how close each card's center is to the
		// screen's center (0 → normal size, 1 → enlarged), smoothed.
		const radius = H * CARD_FOCUS_RADIUS_VH;
		for (let c = 0; c < g.cardEls.length; c++) {
			const d = Math.abs(g.winTop + trackY + g.cardMids[c] - H * 0.5) / radius;
			const b = smoothstep01(1 - d);
			g.cardEls[c].style.transform = b > 0 ? `scale(${1 + CARD_FOCUS_SCALE * b})` : "";
		}
	};
	const layoutOutro = () => {
		const g = outroGeo;
		const W = window.innerWidth;
		const H = window.innerHeight;

		// 1) card measurements.
		g.winTop = communityWindow!.offsetTop;
		g.winH = communityWindow!.offsetHeight;
		g.cardEls = Array.from(communityTrack!.children).filter((el) => !el.hasAttribute("data-community-action")) as HTMLElement[];
		g.cardMids = Float64Array.from(g.cardEls, (el) => el.offsetTop + el.offsetHeight / 2);
		g.lastMid = g.cardMids[g.cardMids.length - 1];

		// 2) camera's vertical speed after the turn: the one that makes
		// the track travel what it needs to (until the last card is
		// centered) exactly between OUTRO_TURN_END and OUTRO_CARDS_REST_AT.
		// r is its ratio to the horizontal speed (the black hole's); ~1 at 1280×800.
		const needed = g.winH - (H * 0.5 - g.winTop - g.lastMid);
		const vDown = Math.max(needed, 1) / (OUTRO_CARDS_REST_AT - OUTRO_TURN_END);
		const r = Math.min(Math.max(vDown / (W * BLACKHOLE_SPEED), 0.6), 1.5);
		buildCamera(r);
		g.cardsTurnEndY = cameraAt(OUTRO_TURN_END).y;

		// 3) the trail.
		const n = Math.ceil((OUTRO_END - OUTRO_LINE_AT) / OUTRO_PATH_DT) + 1;
		const cum = new Float64Array(n);
		const segs: string[] = [];
		let prevX = 0;
		let prevY = 0;
		for (let i = 0; i < n; i++) {
			const t = Math.min(OUTRO_LINE_AT + i * OUTRO_PATH_DT, OUTRO_END);
			const cam = cameraAt(t);
			const tip = tipScreenAt(t);
			const px = cam.x + tip.x;
			const py = cam.y + tip.y;
			if (i === 0) {
				// starts much further left than the screen: the tail end never enters frame.
				segs.push(`M ${px - 2.5 * W} ${py} L ${px} ${py}`);
			} else {
				cum[i] = cum[i - 1] + Math.hypot(px - prevX, py - prevY);
				segs.push(`L ${px} ${py}`);
			}
			prevX = px;
			prevY = py;
		}
		g.prepend = 2.5 * W;
		g.cum = cum;
		g.total = g.prepend + cum[n - 1];
		outroPathEl.setAttribute("d", segs.join(" "));
		outroPathEl.setAttribute("stroke-width", String(W * 0.003));
		outroPathEl.style.strokeDasharray = `${g.total}`;

		// 4) the steps along the asymptote's axis, and the dotted path
		// linking them. the axis is the vertical line the tip falls
		// along (after the turn the camera no longer moves in x); each
		// step sits at the height where its ring touches the tip at its
		// contact instant. the stroke's white→blue gradient switches
		// right at the first step.
		const axisWorldX = cameraAt(OUTRO_TURN_END).x + OUTRO_TIP_FINAL_X * W;
		stepsAct.layout(
			axisWorldX,
			(k) => cameraAt(LINE_CENTER_AT + StepContactOffsets[k]).y + H * OUTRO_TIP_FINAL_Y + StepRadius,
		);
		// the black hole (part B) sits on the same axis, at the height
		// the tip reaches when the camera brakes at BH_CENTER_AT: it ends
		// up EXACTLY below the asymptote's end. the dotted path continues to it.
		g.bhWorldX = axisWorldX;
		g.bhWorldY = cameraAt(BH_CENTER_AT).y + H * OUTRO_TIP_FINAL_Y;
		const firstY = stepsAct.worldY(0);
		routeDotsEl.setAttribute("d", `M ${axisWorldX} ${firstY} L ${axisWorldX} ${g.bhWorldY}`);
		routeGradEl.setAttribute("y1", String(firstY));
		routeGradEl.setAttribute("y2", String(firstY + 1));

		renderOutro(outroClock.t);
	};
	gsap.set(outroLineStar, { xPercent: -50, yPercent: -50 });
	layoutOutro();
	window.addEventListener("resize", layoutOutro);

	return { clock: outroClock, render: renderOutro };
}

export type Outro = ReturnType<typeof createOutro>;
