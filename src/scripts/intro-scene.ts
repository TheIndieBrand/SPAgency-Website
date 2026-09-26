// home page's intro scene: the hero gets "pinned" while the user scrolls,
// the subtitle and buttons fade out, the radar's rotation changes, and the
// stats rise from below and settle a bit past center, counting up from 0 to their real value.
//
// act 2: "lim / x ⟶ ∞" appears in the gap left by the hero's title; the
// "89K+" number and the "Raids bloqueados" label detach from the stats grid
// and form into a title below the limit. while they reposition: more math
// symbols sprout across the screen, the radar spins a bit more, and the
// other stat cells separate and fall away fading out. then the number
// shrinks to occupy the "x" (which fades out).
//
// climax: the "89K+" shoots up counting to a titanic number, the ∞ starts
// shaking, and bam! the cartesian plane emerges from infinity (top-right
// corner) and the curve/function grows. afterward everything drifts left,
// crosses a black hole that curves the asymptote downward, and in the gap
// it leaves, the community's testimonials rise up in a carousel.
//
// this is the site's first gsap piece — built to be extended (more scenes,
// more sections) without touching this base.
//
// this module only exports mountScene(): the page (index.astro) downloads
// it in parallel with the fonts and mounts it once they're loaded.
export { mountScene } from "./scene/mount";
