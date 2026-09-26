// timeline-unit timings and pacing constants for the scene. everything
// other modules need to know about WHEN things happen lives here.

// scroll pacing: with scrub, scroll is distributed proportionally to the
// timeline's duration, so the pin's length is computed from it (mount.ts,
// from tl.duration() once every act is built). the pace the original scene
// was tuned to is 12.6 viewport heights per 54.3 timeline units.
export const TL_UNITS_BASE = 54.3;
export const TL_VIEWPORTS_BASE = 12.6;

export const BURST_POS = 10.0;

export const TRAVEL_START = BURST_POS + 2;
export const AB_DUR = 14; // duration (timeline units) of the phase a+b stretch
export const C_DUR = 12.5; // phase c: the curve draws up to here; then it freezes and EVERYTHING rotates

export const SC = TRAVEL_START + AB_DUR; // where phase c starts

export const OUTRO_LINE_AT = SC + C_DUR + 0.6; // moment the new asymptote starts being drawn
export const OUTRO_LINE_DUR = 2.2;
// initial drawing of the asymptote: the tip (little star) travels from -40vw
// to 60vw (fractions of viewport width) with a power2.out ease. it crosses
// the screen's center (50vw) when 1-(1-t)² = (0.5+0.4)/(0.6+0.4) = 0.9, i.e.
// t = 1-√0.1 ≈ 0.684. that's where the final phase starts.
export const OUTRO_TIP_START_X = -0.4;
export const OUTRO_TIP_REST_X = 0.6;
export const LINE_CENTER_AT =
	OUTRO_LINE_AT +
	OUTRO_LINE_DUR * (1 - Math.sqrt(1 - (0.5 - OUTRO_TIP_START_X) / (OUTRO_TIP_REST_X - OUTRO_TIP_START_X)));

// duration of the black hole crossing (starts at LINE_CENTER_AT + this
// offset) and how long it takes to cross side to side. the star field
// background (further below) drifts for exactly this same stretch, so it
// doesn't sit still while the black hole is still on screen.
export const BLACKHOLE_START_OFFSET = 0.8;
export const BLACKHOLE_CROSS_DUR = 12.5;
// the black hole travels 2.1 viewport widths (from +1.05 to -1.05) over
// BLACKHOLE_CROSS_DUR. the background has to travel at that SAME speed
// (not its own previous one) so it reads as one single camera moving — otherwise
// one outpaces the other even if both finish at the same time.
export const BLACKHOLE_SPEED = 2.1 / BLACKHOLE_CROSS_DUR;
// the background, the asymptote and the community cards follow ONE camera
// (cameraAt, below) all the way to the scene's END — not just while it
// crosses the black hole. NOTE: the black hole is NOT part of that camera:
// its crossing is the scripted sequence above (same path, timings and
// position as always) and the camera doesn't drag it along.
export const OUTRO_TAIL = 55; // from LINE_CENTER_AT to the scene's end
export const OUTRO_END = LINE_CENTER_AT + OUTRO_TAIL;
// must match DEFAULT_YAW in BlackHole.astro — it's where the camera turn
// that animates the crossing starts from (see below, the blackholeOrbit tween).
export const BLACKHOLE_DEFAULT_YAW = 2.94;

// ---- FINAL ACT: the asymptote turns downward and the community arrives ----
// timings, in timeline units (L = LINE_CENTER_AT):
//   L+0.8 … L+13.3   the black hole crosses the screen (scripted; its disk
//                    fully exits the screen by L+11.4)
//   L+7 … L+16.4     THE TURN: the asymptote goes from heading right to
//                    heading down. it's two turns added together, each with
//                    a smooth start and end (smoothstep over the heading):
//                      · PRELUDE (L+7 …): about 9° total, very slight. starts
//                        when the black hole passes right under the tip: a
//                        first tug that links the line to it.
//                      · MAIN TURN (L+11.4 … L+16.4): the remaining ~81°,
//                        once the black hole is already gone. more
//                        concentrated (5 units) than a single turn, so it reads more clearly.
//   L+14             the community heading appears
//   L+16.4 …         the 9 testimonials rise, centered; each grows a bit as
//                    it passes the screen's center, and the last one settles centered
//   L+25.6           the last card reaches center (ALWAYS at this moment:
//                    the camera's vertical speed adjusts to the screen)
//   L+25.75 … L+26.1  the heading and cards fade out (fast and linear: the
//                    last one is read for a moment and leaves)
//   L+26.1 … L+27.7  the asymptote moves to the screen's center
//   L+27.7 …         STILL DESCENDING: the camera no longer stops. the steps
//                    rise from below along the axis and the tip touches them
//                    at L+30.4 / L+34 / L+37.6 (steps-act.ts); after each
//                    contact the path keeps completing to the next one.
//   L+35 … L+37.2    camera ZOOMS OUT (to 0.78): the black hole peeks up from below
//   L+37.6           step 3's contact, the strongest impact; the rumble starts
//   L+39.2 … L+41    the camera brakes as the black hole rises to the center
//   L+41 … L+43      still shot: the black hole centered, under the asymptote
//   L+43 … L+49      IMMERSION: the camera falls into the black hole
//                    (shader), the asymptote and steps power off, the rumble
//                    grows; full black by L+48.85
//   L+49 … L+49.8    silence in black (the rumble cuts out)
//   L+49.8 … L+52.7  a point of light reappears, expands, and the cta emerges from it
//   L+55             end of the scene (OUTRO_END): the cta stays on screen
//                    and once the pin releases it leaves with the scene; the footer arrives behind it
// the camera FOLLOWS the tip (translates, doesn't rotate): its speed is
// BLACKHOLE_SPEED to the right and whatever layoutOutro sets downward (see
// OUTRO_CARDS_REST_AT), following the heading the asymptote is taking. the
// background (parallax 1) and the cards belong to that camera's world; the
// tip stays nearly still on screen and only drifts slowly from (60vw, the
// line) to (75vw, 60vh) during the turn so the arc stays in view. the line
// is drawn in world coordinates: it's the trail that tip leaves behind.
export const OUTRO_TURN_START = LINE_CENTER_AT + 7; // the prelude starts
export const OUTRO_TURN_MAIN_START = LINE_CENTER_AT + 11.4; // the main turn starts
export const OUTRO_TURN_END = LINE_CENTER_AT + 16.4;
export const OUTRO_TURN_PRELUDE_DEG = 9;
export const COMMUNITY_HEADING_AT = LINE_CENTER_AT + 14;
// finale: with the last card already centered (from ~L+25.6 on) the camera
// brakes to a stop, the heading and cards fade out to make way for the next
// section, and once they're gone the asymptote moves to the screen's center
// (as a whole, rigid: at that point all that's visible of it is a vertical
// stretch, so it doesn't deform).
// the last card ALWAYS reaches center at OUTRO_CARDS_REST_AT, whatever the
// screen: the camera's vertical speed after the turn is computed in
// layoutOutro so the distance the cards need to travel (depends on height
// and card size) takes exactly that long. otherwise, on large screens they
// arrived much earlier and sat still until the fade.
export const OUTRO_CARDS_REST_AT = LINE_CENTER_AT + 25.6;
export const COMMUNITY_HOLD = 0.15; // how long the last one is read before leaving
export const COMMUNITY_FADE_AT = OUTRO_CARDS_REST_AT + COMMUNITY_HOLD;
export const COMMUNITY_FADE_DUR = 0.35;
export const OUTRO_SETTLE_AT = COMMUNITY_FADE_AT + COMMUNITY_FADE_DUR;
export const OUTRO_SETTLE_DUR = 1.6;
export const OUTRO_TIP_CENTER_X = 0.5; // where the tip ends up (fractions of w and h)
export const OUTRO_TIP_CENTER_Y = 0.5;
export const OUTRO_TIP_FINAL_X = 0.75; // fractions of w and h where the tip settles
export const OUTRO_TIP_FINAL_Y = 0.6;
// carousel focus: the card passing through the screen's center grows
// (+CARD_FOCUS_SCALE) to give the sense of "this is the one being read" and
// returns to its size once past it. the radius of influence is about one
// card (~its height), so only one at a time is enlarged.
export const CARD_FOCUS_SCALE = 0.1;
export const CARD_FOCUS_RADIUS_VH = 0.2;

// ---- PART B: zoom out, the black hole returns and approaches ----
// approaching the third step, the camera ZOOMS OUT (the whole world scales
// relative to the screen's center): the black hole peeks up from below.
// step 3 completes (the strongest impact) and the camera keeps descending:
// the black hole RISES until it's centered, right under the asymptote's
// end, and the camera brakes and stops there (that's the immersion's
// starting shot). it's the SAME object that crossed before, now acting as a
// body in the world: its position comes from the camera, not its own tween.
export const OUTRO_ZOOM_START = LINE_CENTER_AT + 35;
export const OUTRO_ZOOM_END = LINE_CENTER_AT + 37.2;
export const OUTRO_ZOOM_MIN = 0.78;
export const BH_BRAKE_START = LINE_CENTER_AT + 39.2; // the camera starts braking
export const BH_CENTER_AT = LINE_CENTER_AT + 41; // …and stops: the black hole is centered
// rumble: while the black hole is close, a continuous, slight camera
// tremor (in real time; grows up to RUMBLE_AMP px).
export const RUMBLE_START = LINE_CENTER_AT + 37.8;
export const RUMBLE_AMP = 3.2;

// ---- PART C: immersion into the black hole and emergence into the cta ----
// from the still shot (black hole centered) the camera FALLS in: it's not a
// css zoom but the shader itself (camera distance from 30 down to ~3, and
// the angle tilting upward, falling onto the disk), so the gravitational
// lens actually fires. it accelerates (power2.in) and ends in black.
// everything else (asymptote, steps) powers off; the rumble grows and cuts
// out sharply on reaching black. after a silent black moment, a point of
// light reappears — the tip's star —, expands, and the cta emerges from it (SceneCta.astro).
export const DIVE_START = LINE_CENTER_AT + 43;
export const DIVE_DUR = 6;
export const DIVE_END = DIVE_START + DIVE_DUR;
export const DIVE_DIST_FAR = 30; // = BlackHole.astro's DefaultDist (starting point)
export const DIVE_DIST_NEAR = 3.2; // inside the disk: the shadow fills the whole canvas
export const DIVE_PITCH_START = -0.004; // = BlackHole.astro's DefaultPitch
export const DIVE_PITCH_END = 0.6; // rad: viewed from above, falling onto the disk
export const DIVE_BH_SCALE_END = 1.9; // the canvas (1400px) grows to cover any screen
export const DIVE_BLACK_AT = DIVE_END - 0.9; // full black starts…
export const DIVE_BLACK_DONE = DIVE_END - 0.15; // …and is total here
export const DIVE_RUMBLE_AMP = 8; // the rumble climbs to this during the fall
export const SPARK_AT = LINE_CENTER_AT + 49.8; // the point of light reappears
export const BLOOM_AT = LINE_CENTER_AT + 50.5; // …and expands
export const BLOOM_DUR = 2;
export const CTA_AT = LINE_CENTER_AT + 51.5; // the cta emerges from it
export const CTA_DUR = 1.2;

// timeline points the navbar links go to. since their destinations live
// INSIDE the scene (there's no dom anchor to jump to), mount.ts registers
// them as timeline labels with the same name as the href ("#features",
// "#how"): anchors.ts scrolls to where that part is on screen.
export const ANCHOR_FEATURES_AT = SC + 5.5; // the six "Funciones" cards
export const ANCHOR_HOW_AT = LINE_CENTER_AT + 29.4; // the first step, rising toward the tip
