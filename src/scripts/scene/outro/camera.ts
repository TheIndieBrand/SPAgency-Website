// final act's camera: the asymptote's heading, a camera integrated over
// it, the tip's on-screen position, and zoom. pure computation (no dom)
// except for the viewport size.
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
	// asymptote's heading (and of the camera that follows it) in radians:
	// 0 = rightward, 90° = downward. sum of the slight prelude and the
	// main turn; both are smoothstep, so the sum has a smooth start and
	// end and reaches exactly 90° at OUTRO_TURN_END.
	const headingAt = (t: number) => {
		const prelude =
			OUTRO_TURN_PRELUDE_DEG * smoothstep01((t - OUTRO_TURN_START) / (OUTRO_TURN_END - OUTRO_TURN_START));
		const main =
			(90 - OUTRO_TURN_PRELUDE_DEG) * smoothstep01((t - OUTRO_TURN_MAIN_START) / (OUTRO_TURN_END - OUTRO_TURN_MAIN_START));
		return ((prelude + main) * Math.PI) / 180;
	};

	// camera: integral of (cos θ, sin θ) with θ = headingAt (the turn
	// above), tabulated ONCE in "speed × time" units (viewport-independent);
	// cameraAt interpolates it and scales it by the px speed. speed goes
	// from 1 (rightward heading, the black hole's) to `r` (downward
	// heading) at the heading's own pace; layoutOutro sets r based on the screen.
	const CAM_DT = 0.05;
	const CAM_STEPS = Math.ceil((OUTRO_END - LINE_CENTER_AT) / CAM_DT) + 1;
	const camNormX = new Float64Array(CAM_STEPS);
	const camNormY = new Float64Array(CAM_STEPS);
	const buildCamera = (r: number) => {
		for (let i = 1; i < CAM_STEPS; i++) {
			const tMid = LINE_CENTER_AT + (i - 0.5) * CAM_DT;
			const theta = headingAt(tMid);
			const blend = 1 + (r - 1) * (theta / (Math.PI / 2));
			// constant speed… except for the "hit-stop" on each step's
			// contact: the camera brakes for an instant to give the
			// impact weight (steps-act.ts). and it brakes to a full stop
			// as the black hole reaches the center (part B).
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

	// tip's ON-SCREEN position: the initial drawing (from -40vw to 60vw,
	// power2.out) and, during the turn, the slow drift to its final spot.
	const tipScreenAt = (t: number) => {
		const W = window.innerWidth;
		const H = window.innerHeight;
		// the stroke's center matches that of the bar that used to be
		// there (top:10% + half its 0.3vw thickness).
		const lineY = H * 0.1 + W * 0.0015;
		// the tip shifts on screen at the same pace the heading turns.
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

	// camera zoom: 1 until OUTRO_ZOOM_START and from there, smoothly,
	// down to the zoom out (OUTRO_ZOOM_MIN), where it stays for the immersion.
	const zoomAt = (t: number) =>
		1 + (OUTRO_ZOOM_MIN - 1) * smoothstep01((t - OUTRO_ZOOM_START) / (OUTRO_ZOOM_END - OUTRO_ZOOM_START));

	return { buildCamera, cameraAt, tipScreenAt, zoomAt };
}
