// El acto final como un mundo con cámara: estela de la asíntota, fondo estelar,
// pasos, agujero negro, inmersión y CTA. renderOutro(t) lo pinta todo a partir del
// tiempo; layoutOutro() recalcula las medidas (al montar y en cada resize).
import { gsap } from "gsap";
import type { SceneRefs } from "../dom";
import { createStarField } from "../../star-field";
import { createStepsAct, STEP_CONTACT_OFFSETS, STEP_RADIUS, wobble } from "../../steps-act";
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
		communityWindow,
		communityTrack,
		outroBlackhole,
		outroBlackholeCanvas,
		spaceStars,
		spaceStarsCanvas,
	} = r;
	const { buildCamera, cameraAt, tipScreenAt, zoomAt } = createCamera();
	// Estela: la punta en coordenadas del MUNDO (cámara + posición en pantalla),
	// muestreada en el tiempo y guardada como polilínea; con la longitud
	// acumulada se revela con stroke-dashoffset hasta donde va la punta.
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
		cardMids: new Float64Array(0), // centro de cada tarjeta dentro de la pista
		lastMid: 0,
		bhWorldX: 0, // posición del agujero negro en el mundo (parte B)
		bhWorldY: 0,
	};
	const outroClock = { t: OUTRO_LINE_AT };
	// Fondo estelar infinito: lo dibuja un canvas a partir de la cámara (y del
	// estado de opacidad/bajada que ya animan los tweens sobre #space-stars).
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
	// Envía al shader del agujero negro la distancia y el ángulo de la caída (solo
	// si cambian: renderOutro se llama cada frame).
	const lastDive = { dist: Number.NaN, pitch: Number.NaN };
	const sendDive = (dist: number, pitch: number) => {
		if (Math.abs(dist - lastDive.dist) < 1e-4 && Math.abs(pitch - lastDive.pitch) < 1e-5) return;
		lastDive.dist = dist;
		lastDive.pitch = pitch;
		outroBlackholeCanvas?.dispatchEvent(new CustomEvent("blackhole:orbit", { detail: { dist, pitch } }));
	};
	// Los pasos: nodos del camino en coordenadas del mundo (steps-act.ts). Sus
	// efectos son en tiempo real; requestRender re-pinta la escena en el instante
	// actual cuando lo que cambia no es el scroll sino el shake o la estrella.
	const stepsAct = createStepsAct(stepNodes, () => renderOutro(outroClock.t));
	// Retumbo del agujero negro: temblor CONTINUO y leve (en tiempo real, no atado
	// al scroll) cuyo volumen crece desde RUMBLE_START hasta que el agujero negro
	// llega al centro. Ruido determinista sobre el reloj → mismo carácter siempre.
	// Avance de la caída (0 → 1) y su versión acelerada (power2.in: cae cada vez
	// más rápido). El retumbo sube hasta DIVE_RUMBLE_AMP durante la caída y se
	// CORTA en seco justo antes del negro total: el silencio es parte del efecto.
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
		// Shake de cámara de los impactos y retumbo del agujero negro: se suman a la
		// cámara para que tiemble TODO el mundo (fondo, línea, nodos) a la vez.
		const rumble = rumbleAt(t);
		const shakeX = stepsAct.shake.x + rumble.x;
		const shakeY = stepsAct.shake.y + rumble.y;
		const cam = { x: rawCam.x + shakeX, y: rawCam.y + shakeY };
		const tip = tipScreenAt(t);
		// Zoom de la cámara respecto al centro de la pantalla (c): mundo → pantalla
		// es  c + (mundo − cámara + settle − c) · zoom.
		const z = zoomAt(t);
		const cx = W / 2;
		const cy = H / 2;

		const u = Math.min(Math.max((t - OUTRO_LINE_AT) / OUTRO_PATH_DT, 0), g.cum.length - 1);
		const i = Math.min(Math.floor(u), g.cum.length - 2);
		const revealed = g.prepend + g.cum[i] + (g.cum[i + 1] - g.cum[i]) * (u - i);
		// Remate: la asíntota entera (trazo y punta, en bloque) se desplaza del sitio
		// donde cayó al centro de la pantalla.
		const settle = smoothstep01((t - OUTRO_SETTLE_AT) / OUTRO_SETTLE_DUR);
		const dx = (OUTRO_TIP_CENTER_X - OUTRO_TIP_FINAL_X) * W * settle;
		const dy = (OUTRO_TIP_CENTER_Y - OUTRO_TIP_FINAL_Y) * H * settle;
		outroPathEl.style.strokeDashoffset = `${g.total - revealed}`;
		outroWorldEl.setAttribute(
			"transform",
			`translate(${cx} ${cy}) scale(${z}) translate(${-cam.x + dx - cx} ${-cam.y + dy - cy})`,
		);

		// La estrellita va en el extremo dibujado del trazo (con el shake ya
		// aplicado al trazo, hay que restarlo aquí). Al tocar el primer paso se
		// absorbe dentro del aro: baja hasta su centro mientras se encoge y se apaga.
		const absorb = stepsAct.starAbsorb.k;
		gsap.set(outroLineStar, {
			x: cx + (tip.x + dx - shakeX - cx) * z,
			y: cy + (tip.y + dy - shakeY - cy) * z + STEP_RADIUS * absorb * z,
			scale: z * (1 - 0.85 * absorb),
			opacity: 1 - absorb,
		});

		starField.setCamera(cam.x, cam.y, z);

		// Pasos: nodos del mundo; su estado "completado" es función del tiempo.
		stepsAct.setTime(t - LINE_CENTER_AT);
		stepsAct.render({ W, H, camX: cam.x, camY: cam.y, dx, dy, zoom: z, cx, cy });

		// Agujero negro. Primero su cruce guionizado de siempre (misma fórmula que
		// tenían sus tweens: entra por la derecha con el centro en el borde
		// inferior y sale por la izquierda). Después, ya como cuerpo del mundo,
		// vuelve por debajo: su posición sale de la cámara y del zoom, así que
		// asoma con el zoom out y sube hasta el centro al seguir bajando la cámara.
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
			// El zoom out (0.78) y, en la caída, el crecimiento hasta cubrir la pantalla.
			bhScale = z + (DIVE_BH_SCALE_END - z) * diveK(t);
		}
		gsap.set(outroBlackhole, { x: bhX, y: bhY, scale: bhScale, opacity: bhOpacity });

		// ---- Parte C: inmersión y salida a la CTA ----
		const diveProgress = diveU(t);
		const kDive = diveK(t);
		// El agujero negro crece hasta cubrir la pantalla y su shader CAE: la
		// distancia de cámara baja en geométrica (zoom constante en log) y el
		// ángulo sube, mirando cada vez más desde arriba al disco.
		sendDive(
			DIVE_DIST_FAR * Math.pow(DIVE_DIST_NEAR / DIVE_DIST_FAR, kDive),
			DIVE_PITCH_START + (DIVE_PITCH_END - DIVE_PITCH_START) * kDive,
		);

		// La asíntota y los pasos se apagan al empezar la caída. (El fundido de
		// entrada del trazo, que antes era un tween, también sale de aquí: así
		// una sola función es dueña de esas opacidades.)
		const lineIn = Math.min(Math.max((t - OUTRO_LINE_AT) / 0.35, 0), 1);
		const diveFade = smoothstep01((diveProgress - 0.05) / 0.4);
		outroLineEl.style.opacity = String(lineIn * (1 - diveFade));
		outroStarLayerEl.style.opacity = String(lineIn * (1 - diveFade));
		stepsWorldEl.style.opacity = String(1 - diveFade);

		// Viñeta que se cierra y negro total al llegar dentro.
		diveVignetteEl.style.opacity = String(0.7 * smoothstep01((diveProgress - 0.35) / 0.6));
		diveBlackEl.style.opacity = String(smoothstep01((t - DIVE_BLACK_AT) / (DIVE_BLACK_DONE - DIVE_BLACK_AT)));

		// Del negro: punto de luz → expansión → CTA. El punto se apaga dentro del
		// resplandor que crece; el resplandor cede y deja la tarjeta.
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

		// Tarjetas: son del mundo, así que suben lo que baja la cámara desde que
		// acaba el giro (a la misma velocidad que el fondo). La pista arranca justo
		// debajo de la ventana y se asienta con la última tarjeta CENTRADA en la
		// pantalla (así todas, la última incluida, pasan por el centro y ganan foco).
		const yRest = H * 0.5 - g.winTop - g.lastMid;
		const travelled = Math.max(0, cam.y - g.cardsTurnEndY);
		const trackY = Math.max(yRest, g.winH - travelled);
		gsap.set(communityTrack, { y: trackY });

		// Foco: escala según lo cerca que está el centro de cada tarjeta del centro
		// de la pantalla (0 → tamaño normal, 1 → agrandada), suavizado.
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

		// 1) Medidas de las tarjetas.
		g.winTop = communityWindow!.offsetTop;
		g.winH = communityWindow!.offsetHeight;
		g.cardEls = Array.from(communityTrack!.children) as HTMLElement[];
		g.cardMids = Float64Array.from(g.cardEls, (el) => el.offsetTop + el.offsetHeight / 2);
		g.lastMid = g.cardMids[g.cardMids.length - 1];

		// 2) Velocidad vertical de la cámara tras el giro: la que hace que la
		// pista recorra lo que necesita (hasta centrar la última tarjeta) justo
		// entre OUTRO_TURN_END y OUTRO_CARDS_REST_AT. r es su cociente con la
		// velocidad horizontal (la del agujero negro); ~1 en 1280×800.
		const needed = g.winH - (H * 0.5 - g.winTop - g.lastMid);
		const vDown = Math.max(needed, 1) / (OUTRO_CARDS_REST_AT - OUTRO_TURN_END);
		const r = Math.min(Math.max(vDown / (W * BLACKHOLE_SPEED), 0.6), 1.5);
		buildCamera(r);
		g.cardsTurnEndY = cameraAt(OUTRO_TURN_END).y;

		// 3) La estela.
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
				// Empieza mucho más a la izquierda de la pantalla: el extremo nunca entra en cuadro.
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

		// 4) Los pasos sobre el eje de la asíntota, y el camino punteado que los
		// une. El eje es la vertical por la que cae la punta (tras el giro la
		// cámara ya no se mueve en x); cada paso queda a la altura donde su aro
		// toca la punta en su instante de contacto. El degradado blanco→azul del
		// trazo cambia justo en el primer paso.
		const axisWorldX = cameraAt(OUTRO_TURN_END).x + OUTRO_TIP_FINAL_X * W;
		stepsAct.layout(
			axisWorldX,
			(k) => cameraAt(LINE_CENTER_AT + STEP_CONTACT_OFFSETS[k]).y + H * OUTRO_TIP_FINAL_Y + STEP_RADIUS,
		);
		// El agujero negro (parte B) está en el mismo eje, a la altura a la que la
		// punta llega cuando la cámara frena en BH_CENTER_AT: queda EXACTAMENTE bajo
		// el extremo de la asíntota. El camino punteado sigue hasta él.
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
