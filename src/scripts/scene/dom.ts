// Todas las piezas del DOM que necesita la escena de entrada. Si falta
// cualquiera de las obligatorias, `queryScene()` devuelve null y la página se
// queda con la versión simple (ver mount.ts).

function collectRefs() {
	const navbar = document.getElementById("navbar");
	const introScene = document.getElementById("intro-scene");
	const heroContent = document.getElementById("hero-content");
	const heroTitle = document.querySelector<HTMLElement>("#hero h1");
	const heroSubtitle = document.getElementById("hero-subtitle");
	const heroActions = document.getElementById("hero-actions");
	const radarWrapper = document.getElementById("radar-wrapper");
	const radarPlane = document.querySelector<HTMLElement>(".radar-plane");
	const statsSection = document.getElementById("stats");
	const statNumbers = document.querySelectorAll<HTMLElement>(".stat-number");
	// El título "89K+ Raids bloqueados" del Acto 2 se forma con estas dos piezas
	// REALES de <Stats/> (segunda celda): el número y la etiqueta que va debajo.
	const raidsNumber = (statNumbers[1] as HTMLElement | undefined) ?? null;
	const raidsLabel = (raidsNumber?.nextElementSibling as HTMLElement | null) ?? null;
	const raidsCell = (raidsNumber?.parentElement as HTMLElement | null) ?? null;
	// Las cuatro casillas de la grilla: en el Acto 2 se separan y caen mientras la
	// sección se desvanece. La de "Raids bloqueados" también (aunque ya tenga el
	// contenido despegado), para que no quede parada y descolocada.
	const statCells = Array.from(statNumbers)
		.map((n) => n.parentElement as HTMLElement | null)
		.filter((cell): cell is HTMLElement => cell != null);

	const asymptoteScene = document.getElementById("asymptote-scene");
	const asymptoteGrid = document.getElementById("asymptote-grid");
	const gridLines = document.getElementById("grid-lines");
	const curveTilt = document.getElementById("curve-tilt");
	const outroLine = document.getElementById("outro-line");
	const outroPath = document.getElementById("outro-path") as unknown as SVGPathElement | null;
	const outroLineStar = document.getElementById("outro-line-star");
	const outroStarLayer = document.getElementById("outro-star-layer");
	const outroWorld = document.getElementById("outro-world") as unknown as SVGGElement | null;
	const routeDots = document.getElementById("route-dots") as unknown as SVGPathElement | null;
	const routeGrad = document.getElementById("route-grad") as unknown as SVGLinearGradientElement | null;
	const stepNodes = Array.from(document.querySelectorAll<HTMLElement>(".step-node"));
	const stepsWorld = document.getElementById("steps-world");
	const diveVignette = document.getElementById("dive-vignette");
	const diveBlack = document.getElementById("dive-black");
	const diveBloom = document.getElementById("dive-bloom");
	const diveSpark = document.getElementById("dive-spark");
	const ctaScene = document.getElementById("cta-scene");
	const ctaCard = document.getElementById("cta-scene-card");
	const ctaLink = document.getElementById("cta-scene-link");
	const community = document.getElementById("community");
	const communityHeading = document.getElementById("community-heading");
	const communityWindow = document.getElementById("community-window");
	const communityTrack = document.getElementById("community-track");
	const outroBlackhole = document.getElementById("outro-blackhole");
	const outroBlackholeCanvas = outroBlackhole?.querySelector<HTMLCanvasElement>("canvas[data-blackhole]") ?? null;
	const asymptoteDrift = document.getElementById("asymptote-drift");
	const asymptoteCurve = document.getElementById("asymptote-curve") as unknown as SVGPathElement | null;
	const limitBlock = document.getElementById("limit-block");
	const limitX = document.getElementById("limit-x");
	const limitArrow = document.getElementById("limit-arrow");
	const limitInfinityShake = document.getElementById("limit-infinity-shake");
	const asymptoteCurveHead = document.getElementById("asymptote-curve-head");
	const curveHeadDot = document.getElementById("curve-head-dot");
	const curveHeadStar = document.getElementById("curve-head-star");
	const spaceBg = document.getElementById("space-bg");
	const spaceStars = document.getElementById("space-stars");
	const spaceStarsCanvas = document.getElementById("space-stars-canvas") as HTMLCanvasElement | null;
	const spaceFeatures = document.getElementById("space-features");
	const moon = document.getElementById("moon");
	const spaceFeaturesHeading = document.getElementById("space-features-heading");
	const spaceFeaturesSub = document.getElementById("space-features-sub");
	const spaceFeaturesCards = document.getElementById("space-features-cards");
	const curveProj = document.getElementById("curve-proj");
	const curveProjX = document.getElementById("curve-proj-x");
	const curveProjY = document.getElementById("curve-proj-y");
	const curveProjLabels = document.getElementById("curve-proj-labels");
	const curveProjXLabel = document.getElementById("curve-proj-x-label");
	const curveProjYLabel = document.getElementById("curve-proj-y-label");
	const asymptoteGlyphLayer = document.getElementById("asymptote-glyph-layer");
	const travelCaption1 = document.getElementById("travel-caption-1");
	const travelCaption2 = document.getElementById("travel-caption-2");
	const asymptoteGlyphs = document.querySelectorAll<HTMLElement>(".asymptote-glyph");
	const burstDots = document.querySelectorAll<HTMLElement>(".limit-burst-dot");

	const hasAllPieces = Boolean(
		navbar &&
			introScene &&
			heroContent &&
			heroTitle &&
			heroSubtitle &&
			heroActions &&
			radarWrapper &&
			radarPlane &&
			statsSection &&
			raidsNumber &&
			raidsLabel &&
			asymptoteScene &&
			asymptoteGrid &&
			gridLines &&
			curveTilt &&
				outroLine &&
				outroPath &&
				community &&
				communityHeading &&
				communityWindow &&
				communityTrack &&
				outroLineStar &&
				outroStarLayer &&
				outroWorld &&
				routeDots &&
				routeGrad &&
				stepNodes.length === 3 &&
				stepsWorld &&
				diveVignette &&
				diveBlack &&
				diveBloom &&
				diveSpark &&
				ctaScene &&
				ctaCard &&
				ctaLink &&
				outroBlackhole &&
			asymptoteDrift &&
			asymptoteCurve &&
			limitBlock &&
			limitX &&
			limitArrow &&
			limitInfinityShake &&
			asymptoteCurveHead &&
			curveHeadDot &&
			curveHeadStar &&
			spaceBg &&
			spaceStars &&
			spaceStarsCanvas &&
			spaceFeatures &&
			moon &&
			spaceFeaturesHeading &&
			spaceFeaturesSub &&
			spaceFeaturesCards &&
			curveProj &&
			curveProjX &&
			curveProjY &&
			curveProjLabels &&
			curveProjXLabel &&
			curveProjYLabel &&
			asymptoteGlyphLayer &&
			travelCaption1 &&
			travelCaption2,
	);

	return {
		navbar,
		introScene,
		heroContent,
		heroTitle,
		heroSubtitle,
		heroActions,
		radarWrapper,
		radarPlane,
		statsSection,
		statNumbers,
		raidsNumber,
		raidsLabel,
		raidsCell,
		statCells,
		asymptoteScene,
		asymptoteGrid,
		gridLines,
		curveTilt,
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
		ctaCard,
		ctaLink,
		community,
		communityHeading,
		communityWindow,
		communityTrack,
		outroBlackhole,
		outroBlackholeCanvas,
		asymptoteDrift,
		asymptoteCurve,
		limitBlock,
		limitX,
		limitArrow,
		limitInfinityShake,
		asymptoteCurveHead,
		curveHeadDot,
		curveHeadStar,
		spaceBg,
		spaceStars,
		spaceStarsCanvas,
		spaceFeatures,
		moon,
		spaceFeaturesHeading,
		spaceFeaturesSub,
		spaceFeaturesCards,
		curveProj,
		curveProjX,
		curveProjY,
		curveProjLabels,
		curveProjXLabel,
		curveProjYLabel,
		asymptoteGlyphLayer,
		travelCaption1,
		travelCaption2,
		asymptoteGlyphs,
		burstDots,
		hasAllPieces,
	};
}

type RawRefs = ReturnType<typeof collectRefs>;
type OptionalRefs = "raidsCell" | "outroBlackholeCanvas";

// Con `hasAllPieces` cumplido, todo lo obligatorio existe: se tipa sin null.
export type SceneRefs = { [K in Exclude<keyof RawRefs, OptionalRefs | "hasAllPieces">]: NonNullable<RawRefs[K]> } & Pick<
	RawRefs,
	OptionalRefs
>;

export function queryScene(): SceneRefs | null {
	const { hasAllPieces, ...refs } = collectRefs();
	return hasAllPieces ? (refs as unknown as SceneRefs) : null;
}
