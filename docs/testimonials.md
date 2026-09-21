# Testimonios de la comunidad

Solo web (no necesita nada del bot). Cualquiera con sesión de Discord puede dejar un comentario sobre el bot; **no se ve hasta que el staff lo aprueba**.

> **Estado:** hecho.

## Dónde aparece cada cosa

| Dónde | Qué muestra |
| :---- | :---------- |
| Home (escena y versión simple) | Solo los testimonios elegidos a mano de `src/lib/testimonials.ts`, más el botón **"Agrega el tuyo"** bajo la última tarjeta. **Nunca** los de la comunidad. |
| `/testimonios` | Los mismos de siempre **y** los de la comunidad ya aprobados (del más reciente al más antiguo), sobre el fondo espacial. Aquí se envía el comentario. |
| `/staff/testimonials` | Panel del staff: pendientes, publicados y rechazados. |

El botón del home es transparente, de contorno punteado y mide lo mismo que una tarjeta (320 px). En la escena animada es el último hijo de la pista del carrusel: sube con las tarjetas, no cuenta como tarjeta para centrar ni para el foco (`data-community-action`, ver `outro.ts`) y solo se puede pulsar o enfocar mientras el carrusel está visible. La vía accesible al botón de la escena (que es `aria-hidden`) es el enlace "Testimonios" del footer.

## Flujo

1. El usuario inicia sesión con Discord y escribe (20–400 caracteres, texto plano). Nombre y avatar salen de su sesión, nunca del formulario.
2. `POST /api/testimonials` lo guarda como **pendiente**. La página avisa: *"El staff se reserva el derecho de aprobar cada comentario público."*
3. El staff lo aprueba, lo rechaza o lo devuelve a pendiente desde `/staff/testimonials` (`POST /api/testimonials/review`). Se guarda quién y cuándo.
4. Aprobado, aparece en `/testimonios`. Retirarlo (rechazar uno ya publicado) lo quita al instante.

## Reglas

- **Un solo testimonio publicado por persona.** Si ya tienes uno publicado no puedes enviar otro: o eres uno de los de siempre (tu ID de Discord está en `src/lib/testimonials.ts`) o tienes un comentario aprobado. Si el staff retira el tuyo (queda rechazado), puedes volver a escribir.
- **Un solo pendiente por usuario**, pausa de 60 s entre envíos y **3 al día**. El staff modera todo igualmente; esto solo evita llenarle la cola.
- Se limpia el texto: caracteres de control y de ancho cero fuera, saltos de línea recortados. Se pinta **escapado**, sin markdown ni HTML.
- El avatar solo se guarda y se pinta si viene de la CDN de Discord.
- El usuario ve el estado de su último comentario (pendiente / publicado / no publicado). Nadie ve los pendientes de otros.

## Me gusta

Cada tarjeta de `/testimonios` (las de siempre y las de la comunidad) tiene un botón de me gusta. Ver [`likes.md`](likes.md).

## Staff

Es la lista de `STAFF_IDS` (la misma del asistente). Quien no lo es recibe un 403 en la API y una redirección al home en la página. No hay notificación de comentarios nuevos: hay que entrar a revisar.

## Almacenamiento

SQLite en `data/testimonials.db` (`TESTIMONIALS_DB_PATH`, opcional). En producción, en un disco que persista.
