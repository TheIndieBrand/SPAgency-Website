// Tiempos (en unidades del timeline) y constantes de ritmo de la escena. Todo lo
// que otros módulos necesitan saber sobre CUÁNDO pasa cada cosa vive aquí.

// Ritmo del scroll: con scrub, el scroll se reparte proporcional a la duración
// del timeline, así que la longitud del pin se calcula con ella (mount.ts, a
// partir de tl.duration() una vez construidos todos los actos). El ritmo con el
// que se ajustó la escena original es de 12.6 alturas de viewport por cada 54.3
// unidades de timeline.
export const TL_UNITS_BASE = 54.3;
export const TL_VIEWPORTS_BASE = 12.6;

export const BURST_POS = 10.0;

export const TRAVEL_START = BURST_POS + 2;
export const AB_DUR = 14; // duración (unidades de timeline) del tramo fases A+B
export const C_DUR = 12.5; // fase C: hasta aquí se dibuja la curva; después se congela y TODO gira

export const SC = TRAVEL_START + AB_DUR; // arranque de la fase C

export const OUTRO_LINE_AT = SC + C_DUR + 0.6; // instante en que arranca el dibujado de la asíntota nueva
export const OUTRO_LINE_DUR = 2.2;
// Dibujado inicial de la asíntota: la punta (estrellita) avanza de -40vw a
// 60vw (fracciones del ancho del viewport) con ease power2.out. Cruza el
// centro de pantalla (50vw) cuando 1-(1-t)² = (0.5+0.4)/(0.6+0.4) = 0.9, o
// sea t = 1-√0.1 ≈ 0.684. Ahí arranca la fase final.
export const OUTRO_TIP_START_X = -0.4;
export const OUTRO_TIP_REST_X = 0.6;
export const LINE_CENTER_AT =
	OUTRO_LINE_AT +
	OUTRO_LINE_DUR * (1 - Math.sqrt(1 - (0.5 - OUTRO_TIP_START_X) / (OUTRO_TIP_REST_X - OUTRO_TIP_START_X)));

// Duración del cruce del agujero negro (arranca LINE_CENTER_AT + este
// offset) y cuánto tarda en cruzar de lado a lado. El fondo de estrellas
// (más abajo) deriva durante exactamente este mismo tramo, para no
// quedarse parado mientras el agujero negro sigue en pantalla.
export const BLACKHOLE_START_OFFSET = 0.8;
export const BLACKHOLE_CROSS_DUR = 12.5;
// El agujero negro recorre 2.1 anchos de viewport (de +1.05 a -1.05) en
// BLACKHOLE_CROSS_DUR. El fondo tiene que viajar a esa MISMA velocidad
// (no a la suya propia de antes) para que lea como una sola cámara
// moviéndose — si no, uno adelanta al otro aunque los dos terminen a la
// vez.
export const BLACKHOLE_SPEED = 2.1 / BLACKHOLE_CROSS_DUR;
// El fondo, la asíntota y las tarjetas de la comunidad siguen a UNA cámara
// (cameraAt, más abajo) hasta el FINAL de la escena — no solo mientras cruza
// el agujero negro. OJO: el agujero negro NO forma parte de esa cámara: su
// cruce es el guionizado arriba (mismo camino, tiempos y posición de
// siempre) y la cámara no lo arrastra.
export const OUTRO_TAIL = 55; // de LINE_CENTER_AT al final de la escena
export const OUTRO_END = LINE_CENTER_AT + OUTRO_TAIL;
// Debe coincidir con DEFAULT_YAW en BlackHole.astro — es desde donde arranca
// el giro de cámara que anima el cruce (ver más abajo, tween de blackholeOrbit).
export const BLACKHOLE_DEFAULT_YAW = 2.94;

// ---- ACTO FINAL: la asíntota gira hacia abajo y llega la comunidad ----
// Tiempos, en unidades de timeline (L = LINE_CENTER_AT):
//   L+0.8 … L+13.3   el agujero negro cruza la pantalla (guionizado; su disco
//                    sale del todo de pantalla hacia L+11.4)
//   L+7 … L+16.4     EL GIRO: la asíntota pasa de ir hacia la derecha a ir
//                    hacia abajo. Son dos giros sumados, cada uno con arranque
//                    y final suaves (smoothstep sobre el rumbo):
//                      · PRELUDIO (L+7 …): unos 9° en total, muy leves. Empieza
//                        cuando el agujero negro pasa justo bajo la punta: un
//                        primer tirón que enlaza la línea con él.
//                      · GIRO PRINCIPAL (L+11.4 … L+16.4): los ~81° restantes,
//                        cuando el agujero negro ya se ha ido. Más concentrado
//                        (5 unidades) que un giro único, así que se nota más.
//   L+14             aparece el encabezado de la comunidad
//   L+16.4 …         suben los 9 testimonios, centrados; cada una crece un poco
//                    al pasar por el centro de la pantalla y la última se asienta
//                    centrada
//   L+25.6           la última tarjeta llega al centro (SIEMPRE en este instante:
//                    la velocidad vertical de la cámara se ajusta a la pantalla)
//   L+25.75 … L+26.1  se desvanecen el encabezado y las tarjetas (rápido y lineal:
//                    la última se lee un instante y se va)
//   L+26.1 … L+27.7  la asíntota se desplaza al centro de la pantalla
//   L+27.7 …         SEGUIMOS BAJANDO: la cámara ya no se detiene. Los pasos suben
//                    desde abajo por el eje y la punta los toca en L+30.4 / L+34 /
//                    L+37.6 (steps-act.ts); tras cada contacto el camino se va
//                    completando hasta el siguiente.
//   L+35 … L+37.2    ZOOM OUT de la cámara (a 0.78): asoma por abajo el agujero negro
//   L+37.6           contacto del paso 3, el impacto más fuerte; empieza el retumbo
//   L+39.2 … L+41    la cámara frena mientras el agujero negro sube al centro
//   L+41 … L+43      plano quieto: el agujero negro en el centro, bajo la asíntota
//   L+43 … L+49      INMERSIÓN: la cámara cae dentro del agujero negro (shader), la
//                    asíntota y los pasos se apagan, el retumbo crece; negro total
//                    hacia L+48.85
//   L+49 … L+49.8    silencio en negro (el retumbo se corta)
//   L+49.8 … L+52.7  un punto de luz reaparece, se expande y de él emerge la CTA
//   L+55             fin de la escena (OUTRO_END): la CTA queda en pantalla y al
//                    soltarse el pin se va con la escena; detrás llega el footer
// La cámara SIGUE a la punta (se traslada, no gira): su velocidad es
// BLACKHOLE_SPEED hacia la derecha y la que fija layoutOutro hacia abajo (ver
// OUTRO_CARDS_REST_AT), con el rumbo que va tomando la asíntota. El fondo
// (parallax 1) y las tarjetas son del mundo de esa cámara; la punta se queda
// casi quieta en pantalla y solo se desplaza despacio de (60vw, línea) a
// (75vw, 60vh) durante el giro para que el arco quede a la vista. La línea
// se dibuja en coordenadas del mundo: es la estela que deja esa punta.
export const OUTRO_TURN_START = LINE_CENTER_AT + 7; // empieza el preludio
export const OUTRO_TURN_MAIN_START = LINE_CENTER_AT + 11.4; // empieza el giro principal
export const OUTRO_TURN_END = LINE_CENTER_AT + 16.4;
export const OUTRO_TURN_PRELUDE_DEG = 9;
export const COMMUNITY_HEADING_AT = LINE_CENTER_AT + 14;
// Remate: con la última tarjeta ya centrada (a partir de ~L+25.6) la cámara
// frena hasta pararse, el encabezado y las tarjetas se desvanecen para dar
// paso a la sección siguiente, y una vez desaparecidos la asíntota se
// desplaza al centro de la pantalla (toda entera, rígida: en ese punto lo
// único visible de ella es un tramo vertical, así que no se deforma).
// La última tarjeta llega SIEMPRE al centro en OUTRO_CARDS_REST_AT, sea cual
// sea la pantalla: la velocidad vertical de la cámara tras el giro se calcula
// en layoutOutro para que el recorrido que necesitan las tarjetas (depende
// del alto y del tamaño de las tarjetas) dure justo eso. Si no, en pantallas
// grandes llegaban mucho antes y se quedaban paradas hasta el desvanecido.
export const OUTRO_CARDS_REST_AT = LINE_CENTER_AT + 25.6;
export const COMMUNITY_HOLD = 0.15; // lo que se lee la última antes de irse
export const COMMUNITY_FADE_AT = OUTRO_CARDS_REST_AT + COMMUNITY_HOLD;
export const COMMUNITY_FADE_DUR = 0.35;
export const OUTRO_SETTLE_AT = COMMUNITY_FADE_AT + COMMUNITY_FADE_DUR;
export const OUTRO_SETTLE_DUR = 1.6;
export const OUTRO_TIP_CENTER_X = 0.5; // dónde acaba la punta (fracciones de W y H)
export const OUTRO_TIP_CENTER_Y = 0.5;
export const OUTRO_TIP_FINAL_X = 0.75; // fracciones de W y H donde queda la punta
export const OUTRO_TIP_FINAL_Y = 0.6;
// Foco del carrusel: la tarjeta que pasa por el centro de la pantalla crece
// (+CARD_FOCUS_SCALE) para dar la sensación de "esta es la que se lee" y
// vuelve a su tamaño al superarlo. El radio de influencia es del orden de
// una tarjeta (~ su alto), así que solo una a la vez está agrandada.
export const CARD_FOCUS_SCALE = 0.1;
export const CARD_FOCUS_RADIUS_VH = 0.2;

// ---- PARTE B: zoom out, el agujero negro vuelve y se acerca ----
// Al acercarse al tercer paso la cámara hace ZOOM OUT (todo el mundo escala
// respecto al centro de la pantalla): asoma por abajo el agujero negro. Se
// completa el paso 3 (el impacto más fuerte) y la cámara sigue bajando: el
// agujero negro SUBE hasta quedar en el centro, justo bajo el extremo de la
// asíntota, y la cámara frena y se para ahí (ese es el plano de partida de
// la inmersión). Es el MISMO objeto que cruzó antes, ahora como cuerpo del
// mundo: su posición sale de la cámara, no de un tween propio.
export const OUTRO_ZOOM_START = LINE_CENTER_AT + 35;
export const OUTRO_ZOOM_END = LINE_CENTER_AT + 37.2;
export const OUTRO_ZOOM_MIN = 0.78;
export const BH_BRAKE_START = LINE_CENTER_AT + 39.2; // la cámara empieza a frenar
export const BH_CENTER_AT = LINE_CENTER_AT + 41; // …y para: el agujero negro está en el centro
// Retumbo: mientras el agujero negro está cerca, un temblor continuo y leve
// de la cámara (en tiempo real; crece hasta RUMBLE_AMP px).
export const RUMBLE_START = LINE_CENTER_AT + 37.8;
export const RUMBLE_AMP = 3.2;

// ---- PARTE C: inmersión en el agujero negro y salida a la CTA ----
// Desde el plano quieto (agujero negro centrado) la cámara CAE dentro: no es
// un zoom de CSS sino el propio shader (distancia de cámara de 30 a ~3 y
// ángulo hacia arriba, cayendo sobre el disco), así que la lente
// gravitacional se dispara de verdad. Acelera (power2.in) y termina en negro.
// Lo demás (asíntota, pasos) se apaga; el retumbo crece y se corta en seco al
// llegar al negro. Tras un silencio de negro reaparece un punto de luz — la
// estrella de la punta —, se expande y de él emerge la CTA (SceneCta.astro).
export const DIVE_START = LINE_CENTER_AT + 43;
export const DIVE_DUR = 6;
export const DIVE_END = DIVE_START + DIVE_DUR;
export const DIVE_DIST_FAR = 30; // = DEFAULT_DIST de BlackHole.astro (punto de partida)
export const DIVE_DIST_NEAR = 3.2; // dentro del disco: la sombra ocupa todo el canvas
export const DIVE_PITCH_START = -0.004; // = DEFAULT_PITCH de BlackHole.astro
export const DIVE_PITCH_END = 0.6; // rad: se mira desde arriba, cayendo sobre el disco
export const DIVE_BH_SCALE_END = 1.9; // el canvas (1400px) crece hasta cubrir cualquier pantalla
export const DIVE_BLACK_AT = DIVE_END - 0.9; // empieza el negro total…
export const DIVE_BLACK_DONE = DIVE_END - 0.15; // …y es total aquí
export const DIVE_RUMBLE_AMP = 8; // el retumbo sube hasta esto durante la caída
export const SPARK_AT = LINE_CENTER_AT + 49.8; // el punto de luz reaparece
export const BLOOM_AT = LINE_CENTER_AT + 50.5; // …y se expande
export const BLOOM_DUR = 2;
export const CTA_AT = LINE_CENTER_AT + 51.5; // de él emerge la CTA
export const CTA_DUR = 1.2;
