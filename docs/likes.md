# Me gusta

Solo web. Cualquiera con sesión de Discord puede dar **un** me gusta a cada cosa gustable; se puede quitar volviendo a pulsar. Se ve el contador sin sesión.

## Qué se puede gustar

| Qué | Dónde | Target (interno) |
| :-- | :---- | :--------------- |
| Testimonio de los de siempre (los del home) | Solo en `/testimonios` | `testimonial:curated:<ID de Discord>` |
| Comentario de la comunidad (aprobado) | Solo en `/testimonios` | `testimonial:community:<id>` |
| Entrada del changelog **publicada** | La lista y la página de cada entrada | `changelog:<id>` |

En el home no hay botones de me gusta. Los borradores del changelog y los comentarios sin aprobar no se pueden gustar (la API los rechaza).

## Reglas

- **Sin sesión:** el botón se ve (y muestra el contador); al pulsarlo lleva al login de Discord y vuelve a la misma página.
- **Nadie puede gustarse a sí mismo:** en los testimonios, el botón del propio autor solo muestra el contador (y la API responde `403 own_target`). Para los de siempre, el autor se identifica con el `userId` de `src/lib/testimonials.ts`.
- **Freno:** como mucho 20 cambios cada 10 s por usuario (`429`).
- **Optimista:** el botón cambia al instante y se corrige con lo que responda el servidor; si hay varios botones del mismo target en la página (la lista del changelog tiene uno para escritorio y otro para móvil) se actualizan a la vez.

## API

`POST /api/likes` con `{ "target": "…" }` (JSON, con sesión). **Alterna** el me gusta y responde `{ "liked": boolean, "count": number }`. Errores: `400 invalid_target`, `401`, `403 own_target`, `429 rate_limited`.

## Almacenamiento

SQLite en `data/likes.db` (`LIKES_DB_PATH`, opcional): una fila `(target, user_id, created_at)` por me gusta, clave primaria `(target, user_id)`. En producción, en un disco que persista.
