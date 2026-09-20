# Asistente de IA

Chat con IA para resolver dudas sobre el bot leyendo la propia web, y para abrir un ticket cuando no pueda. **Vive solo en la web**: no necesita nada del bot salvo el contrato de tickets de [`support.md`](support.md) (que ya usa para abrirlos).

> **Estado:** hecho. Aún no cambia configuración (llegará con el Postgres del dashboard).

## Filosofía

1. **Tokens escasos.** Lo caro es reenviar contexto en cada turno. Se manda un prompt fijo y corto, los 2-3 fragmentos de la web relevantes para *esa* pregunta y los últimos mensajes; nunca la web entera.
2. **El modelo propone, la web ejecuta.** El modelo no abre tickets ni escribe nada: solo propone, y el usuario confirma con un botón. La identidad sale siempre de la sesión de Discord, nunca del modelo ni del cuerpo de la petición.
3. **Aviso antes de chatear.** El usuario acepta (con versión y fecha guardadas) que el staff puede leer sus conversaciones, que se guardan y que las procesa el proveedor de IA.

## Flujo de un mensaje

`POST /api/chat` `{ message, conversationId? }` → respuesta **SSE** (`text/event-stream`).

1. Comprobaciones: sesión, aviso aceptado, tamaño (`MAX_INPUT_CHARS`), cupo diario, límite por minuto y una generación a la vez por usuario.
2. Se enmascaran secretos evidentes (`redact.ts`) y se guarda el mensaje.
3. Recuperación (`knowledge.ts`): BM25 sobre `knowledge/`, sin llamar al modelo. Un mensaje muy corto se busca junto con el anterior.
4. Se llama a DeepSeek en streaming. El contexto va **en el mensaje del usuario**, nunca en el de sistema, para que el prefijo repetido (sistema + historial) lo cachee el proveedor.
5. Se guarda la respuesta y el gasto, y se cierra el flujo.

Eventos SSE: `meta {conversationId}`, `html {html}` (texto acumulado, ya en HTML saneado), `proposal {id, subject, summary}`, `done {usage}`, `error {message}`.

Si el cliente corta a mitad, lo generado se conserva y se cobra por estimación.

## Botones de ruta

Cuando el asistente cita una página de la web, se muestra como **botón** hacia la ruta oficial (con icono según la sección y el título de la página) en lugar de un enlace de texto. Lo hace `scripts/chat-links.ts` sobre el HTML ya saneado y cubre tres casos: enlaces de Markdown (`[Anti-Raid](/docs/anti-raid)`), rutas sueltas en el texto (`/docs/anti-raid#lista-blanca`, que se muestra como «Anti-Raid › lista blanca») y rutas entre `código`.

Solo se convierten las rutas que **existen**: la lista sale del mapa del sitio (`_sitemap.md`, vía `siteRoutes()` en `GET /api/chat/state`) más `/changelog/*` y `/support/tickets/*`. Una ruta inventada por el modelo se queda como texto, y un comando como `/backup` no se confunde con una ruta (solo cuentan las que empiezan por `/docs`, `/support`, `/changelog` o `/dashboard`). El estilo está en `global.css` (`.route-chip`).

## Comandos del chat

Escritos en la caja de mensaje (al teclear `/` sale un menú; `Tab` completa). Se resuelven en el servidor y se leen antes de mandar nada al modelo. Un mensaje que empiece por `/` pero no sea uno de estos dos se trata como una pregunta normal.

| Comando | Qué hace | Coste |
| :------ | :------- | :---- |
| `/usage` | Consumo de hoy en detalle: unidades usadas y restantes, mensajes, tokens de entrada nueva / caché / salida, cuándo se restablece, media por mensaje y mensajes que quedan (estimados), y los últimos 7 días. `GET /api/chat/usage`. | Nada (no llama al modelo). Efímero: no se guarda en la conversación. |
| `/ticket [descripción]` | La IA redacta asunto y resumen a partir de la conversación (y de la descripción, si se da) y se muestra la tarjeta de propuesta de siempre. `POST /api/chat/ticket`. | Una llamada al modelo (~1.000 unidades). Se guardan el comando y la propuesta. |

`/ticket` comprueba antes, sin gastar nada, que el usuario no tenga ya un ticket abierto (responde con el enlace) y que haya algo que contar (una conversación o una descripción). Después pasa por las mismas comprobaciones que un mensaje: aviso aceptado, cupo diario, límite por minuto y una generación a la vez. La llamada usa la herramienta `offer_ticket` **forzada** (`tool_choice`) y sin streaming.

## Base de conocimiento: `pnpm knowledge`

Genera `knowledge/*.md` (no se sube a git) con la web en Markdown, leyendo las **mismas fuentes que pintan las páginas**, así que no hay nada que mantener a mano:

| Origen | Cómo |
| :----- | :--- |
| Docs (`src/lib/docs`) | Se convierten los bloques a Markdown. |
| Home (`home-content.ts`, `steps.ts`, `site.ts`) | Idem. |
| Dashboard (`src/pages/dashboard/[guildId]/*.astro`) | Se extraen `SettingCard`, `Toggle`, `FieldRow` y sus opciones del propio marcado. |
| Changelog | No pasa por aquí: vive en SQLite y se lee en vivo (cada 5 min). |

Se ejecuta solo antes de `pnpm dev` y `pnpm build` (`predev` / `prebuild`), y a mano con `pnpm knowledge`. También genera `_sitemap.md` (título y ruta de cada página), que va en el prompt de sistema. Si se añade una página o un ajuste nuevo, aparece con el siguiente arranque.

El buscador recarga el índice si cambian los archivos, sin reiniciar el servidor.

## Cupo diario

Se mide en **unidades ponderadas** (`usage.ts`): entrada nueva = 1, entrada cacheada = 0,1, salida = 4. Cada llamada al modelo suma, además de las unidades, sus tokens de entrada, de caché y de salida y el nº de llamadas (tabla `usage_daily`), que es lo que detalla `/usage`. Así el contexto cacheado casi no cuenta y la salida (lo caro) sí. Por defecto 100.000 al día (`CHAT_DAILY_TOKEN_LIMIT`), con reinicio a medianoche de Madrid. Vive en su propia tabla: borrar una conversación **no** devuelve cupo.

## Tickets

El modelo dispone de una herramienta, `offer_ticket(subject, summary)`. Al llamarla se guarda una **propuesta** (caduca a las 24 h) y la interfaz muestra una tarjeta. Al confirmar, `POST /api/chat/proposals/:id` abre el ticket con el mismo `createTicket` que usa `/support` (mismos límites y errores: un ticket abierto por usuario, etc.).

- **El primer mensaje del ticket lo genera la IA y así se indica** (`ticket.ts`): cabecera de aviso, el resumen y el ID de la conversación para que el staff la localice.
- El usuario accede al ticket como siempre, en `/support/tickets/<id>`. La tarjeta pasa a "Ir al ticket" y la conversación queda enlazada.
- Confirmar es atómico (`moveProposal`): un doble clic no abre dos tickets, y si el bot falla la propuesta vuelve a estar disponible.

## Conversaciones y staff

Se guardan en `data/chat.db` (`CHAT_DB_PATH`). **El usuario no puede borrarlas**; el aviso y la interfaz le dicen que se lo pida al staff. El staff (IDs en `STAFF_IDS`) tiene `/staff/chat`: buscar por usuario, ID o título, leer y borrar. Cada búsqueda, lectura y borrado queda en `staff_audit` con el ID de quien lo hizo (el borrado guarda qué conversación era, no su contenido).

Las rutas de staff comprueban el permiso en el servidor en cada petición; sin `STAFF_IDS` nadie es staff.

## Variables de entorno

Ver `.env.example`: `DEEPSEEK_API_KEY` (sin ella, "no disponible"), `DEEPSEEK_BASE_URL`, `CHAT_MODEL`, `CHAT_DAILY_TOKEN_LIMIT`, `STAFF_IDS`, `CHAT_DB_PATH`, `KNOWLEDGE_DIR`. La API de DeepSeek es compatible con la de OpenAI: cambiando URL y modelo sirve otro proveedor compatible.

## Límites que conviene conocer (`config.ts`)

| Límite | Valor |
| :----- | :---- |
| Mensaje del usuario | 1200 caracteres |
| Respuesta | 500 tokens |
| Historial reenviado | 8 mensajes |
| Fragmentos inyectados | 3, de hasta 1500 caracteres |
| Mensajes por minuto | 10 |

## Pendiente

- Herramientas de lectura y escritura de la configuración del servidor (requieren conectar el dashboard al Postgres real y un registro único de ajustes que alimente el dashboard, la validación y el conocimiento).
- Cambiar `CONSENT_VERSION` cuando cambie el texto del aviso (`pages/support/assistant.astro`) para volver a pedir la aceptación.
