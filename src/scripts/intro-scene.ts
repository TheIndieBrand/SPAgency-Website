// Escena de entrada del Home: el Hero se "pinea" mientras el usuario hace
// scroll, el subtítulo y los botones se desvanecen, el radar cambia de
// rotación, y las estadísticas suben desde abajo y se asientan un poco
// después del centro, contando desde 0 hasta su valor real.
//
// Acto 2: aparece "lim / x ⟶ ∞" en el hueco del título del hero; el número
// "89K+" y la etiqueta "Raids bloqueados" se despegan de la grilla de stats y
// se forman como título debajo del límite. Mientras se recolocan: brotan más
// símbolos matemáticos por la pantalla, el radar gira algo más y las otras
// casillas de stats se separan y caen desvaneciéndose. Luego el número se
// encoge hasta ocupar la "x" (que se desvanece).
//
// Desenlace: el "89K+" se dispara contando hasta un número titánico, el ∞
// empieza a temblar y ¡zas! el plano cartesiano emerge desde el infinito
// (esquina sup-der) y la curva/función crece. Después todo deriva a la
// izquierda, cruza un agujero negro que curva la asíntota hacia abajo, y en el
// hueco que deja suben, en carrusel, los testimonios de la comunidad.
//
// Es la primera pieza de GSAP del sitio — pensada para irse ampliando
// (más escenas, más secciones) sin tocar esta base.
import { mountScene } from "./scene/mount";

mountScene();
