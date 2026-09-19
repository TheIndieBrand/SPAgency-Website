// Cámara del acto final: rumbo de la asíntota, cámara integrada sobre él, posición
// de la punta en pantalla y zoom. Cálculo puro (sin DOM) salvo el tamaño del viewport.
import { hitStopFactor } from "../../steps-act";
import {
	OUTRO_LINE_AT,
	OUTRO_LINE_DUR,
	OUTRO_TIP_START_X,
	OUTRO_TIP_REST_X,
	LINE_CENTER_AT,
	BLACKHOLE_SPEED,
	OUTRO_END,
	OUTRO_TURN_START,
	OUTRO_TURN_MAIN_START,
	OUTRO_TURN_END,
	OUTRO_TURN_PRELUDE_DEG,
	OUTRO_TIP_FINAL_X,
	OUTRO_TIP_FINAL_Y,
	OUTRO_ZOOM_START,
	OUTRO_ZOOM_END,
	OUTRO_ZOOM_MIN,
	BH_BRAKE_START,
	BH_CENTER_AT,
} from "../timing";

export const smoothstep01 = (k: number) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));

export function createCamera() {
	// Rumbo de la asíntota (y de la cámara que la sigue) en radianes: 0 = hacia
	// la derecha, 90° = hacia abajo. Suma del preludio leve y del giro principal;
	// los dos son smoothstep, así que la suma tiene arranque y final suaves y
	// llega a 90° exactos en OUTRO_TURN_END.
	const headingAt = (t: number) => {
		const prelude =
			OUTRO_TURN_PRELUDE_DEG * smoothstep01((t - OUTRO_TURN_START) / (OUTRO_TURN_END - OUTRO_TURN_START));
		const main =
			(90 - OUTRO_TURN_PRELUDE_DEG) * smoothstep01((t - OUTRO_TURN_MAIN_START) / (OUTRO_TURN_END - OUTRO_TURN_MAIN_START));
		return ((prelude + main) * Math.PI) / 180;
	};

	// Cámara: integral de (cos θ, sin θ) con θ = headingAt (el giro de arriba),
	// tabulada UNA vez en unidades de "velocidad × tiempo" (independiente del
	// viewport); cameraAt la interpola y la escala por la velocidad en px.
	// La velocidad pasa de 1 (rumbo derecha, la del agujero negro) a `r` (rumbo
	// abajo) al ritmo del rumbo; r la fija layoutOutro según la pantalla.
	const CAM_DT = 0.05;
	const CAM_STEPS = Math.ceil((OUTRO_END - LINE_CENTER_AT) / CAM_DT) + 1;
	const camNormX = new Float64Array(CAM_STEPS);
	const camNormY = new Float64Array(CAM_STEPS);
	const buildCamera = (r: number) => {
		for (let i = 1; i < CAM_STEPS; i++) {
			const tMid = LINE_CENTER_AT + (i - 0.5) * CAM_DT;
			const theta = headingAt(tMid);
			const blend = 1 + (r - 1) * (theta / (Math.PI / 2));
			// Velocidad constante… salvo el "hit-stop" de cada contacto de los pasos: la
			// cámara se frena un instante para dar peso al impacto (steps-act.ts).
			// Y frena hasta pararse cuando el agujero negro llega al centro (parte B).
			const brake = 1 - smoothstep01((tMid - BH_BRAKE_START) / (BH_CENTER_AT - BH_BRAKE_START));
			const speed = blend * hitStopFactor(tMid - LINE_CENTER_AT) * brake;
			camNormX[i] = camNormX[i - 1] + Math.cos(theta) * CAM_DT * speed;
			camNormY[i] = camNormY[i - 1] + Math.sin(theta) * CAM_DT * speed;
		}
	};
	const cameraAt = (t: number) => {
		const u = (t - LINE_CENTER_AT) / CAM_DT;
		if (u <= 0) return { x: 0, y: 0 };
		const i = Math.min(Math.floor(u), CAM_STEPS - 2);
		const f = Math.min(u - i, 1);
		const speed = window.innerWidth * BLACKHOLE_SPEED;
		return {
			x: (camNormX[i] + (camNormX[i + 1] - camNormX[i]) * f) * speed,
			y: (camNormY[i] + (camNormY[i + 1] - camNormY[i]) * f) * speed,
		};
	};

	// Posición de la punta EN PANTALLA: el dibujado inicial (de -40vw a 60vw,
	// power2.out) y, durante el giro, el desplazamiento lento a su sitio final.
	const tipScreenAt = (t: number) => {
		const W = window.innerWidth;
		const H = window.innerHeight;
		// El centro del trazo coincide con el de la barra que había antes
		// (top:10% + la mitad de su grosor de 0.3vw).
		const lineY = H * 0.1 + W * 0.0015;
		// La punta se desplaza en pantalla al mismo ritmo que gira el rumbo.
		const e = headingAt(t) / (Math.PI / 2);
		let fx: number;
		if (t < OUTRO_LINE_AT + OUTRO_LINE_DUR) {
			const k = Math.min(Math.max((t - OUTRO_LINE_AT) / OUTRO_LINE_DUR, 0), 1);
			fx = OUTRO_TIP_START_X + (OUTRO_TIP_REST_X - OUTRO_TIP_START_X) * (1 - (1 - k) * (1 - k));
		} else {
			fx = OUTRO_TIP_REST_X + (OUTRO_TIP_FINAL_X - OUTRO_TIP_REST_X) * e;
		}
		return { x: W * fx, y: lineY + (H * OUTRO_TIP_FINAL_Y - lineY) * e };
	};

	// Zoom de la cámara: 1 hasta OUTRO_ZOOM_START y de ahí, suave, hasta el
	// zoom out (OUTRO_ZOOM_MIN), donde se queda para la inmersión.
	const zoomAt = (t: number) =>
		1 + (OUTRO_ZOOM_MIN - 1) * smoothstep01((t - OUTRO_ZOOM_START) / (OUTRO_ZOOM_END - OUTRO_ZOOM_START));

	return { buildCamera, cameraAt, tipScreenAt, zoomAt };
}
