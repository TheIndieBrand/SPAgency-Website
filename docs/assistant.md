# Asistente de IA

Chat con IA para resolver dudas sobre el bot leyendo la propia web, y para abrir un ticket cuando no pueda. **Vive solo en la web**: no necesita nada del bot salvo el contrato de tickets de [`support.md`](support.md) (que ya usa para abrirlos).

> **Estado:** hecho, incluida la configuración del servidor (ver «Configurar el servidor»).

## Filosofía

1. **Tokens escasos.** Lo caro es reenviar contexto en cada turno. Se manda un prompt fijo y corto, los 2-3 fragmentos de la web relevantes para *esa* pregunta y los últimos mensajes; nunca la web entera.
2. **El modelo propone, la web ejecuta.** El modelo no abre tickets ni cambia ajustes: solo propone, y el usuario confirma con un botón. La identidad sale siempre de la sesión de Discord, nunca del modelo ni del cuerpo de la petición.
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

Escritos en la caja de mensaje. Funcionan como los slash commands de Discord: al teclear `/` sale la lista, cada comando con la caja de sus parámetros (discontinua y con «opcional» si lo es); `Tab` o un clic lo completan y, al escribir el comando y un espacio, un panel explica el parámetro, sugiere valores (`on`/`off`, secciones) y muestra la caja rellena con lo que se teclea. Los parámetros se declaran en `COMMANDS` de `scripts/assistant.ts`. Se resuelven en el servidor y se leen antes de mandar nada al modelo. Un mensaje que empiece por `/` pero no sea uno de estos se trata como una pregunta normal.

| Comando | Qué hace | Coste |
| :------ | :------- | :---- |
| `/usage` | Consumo de hoy en detalle: unidades usadas y restantes, mensajes, tokens de entrada nueva / caché / salida, cuándo se restablece, media por mensaje y mensajes que quedan (estimados), y los últimos 7 días. `GET /api/chat/usage`. | Nada (no llama al modelo). Efímero: no se guarda en la conversación. |
| `/servidor [nombre]` | Elige el servidor sobre el que actúa el asistente **en esa conversación**. Sin argumento, lista los tuyos como botones; acepta nombre, parte del nombre, número o ID. `POST /api/chat/command`. | Nada. Al elegir guarda el comando y la elección, así que exige haber aceptado el aviso. |
| `/config [sección]` | Ajustes actuales del servidor elegido (`protección`, `automoderación`, `alertas`, `general`; sin sección, todas). | Nada. Efímero. |
| `/panico [on\|off]` | Prepara la propuesta de activar o apagar el Modo Pánico (sin argumento, el contrario del estado actual). Es el atajo de emergencia: no espera al modelo. | Nada. Guarda el comando y la propuesta, así que exige haber aceptado el aviso. |
| `/registros` | Los 10 últimos eventos del servidor elegido (los mismos que Registros del dashboard). | Nada. Efímero. |
| `/ticket [descripción]` | La IA redacta asunto y resumen a partir de la conversación (y de la descripción, si se da) y se muestra la tarjeta de propuesta de siempre. `POST /api/chat/ticket`. | Una llamada al modelo (~1.000 unidades). Se guardan el comando y la propuesta. |

`/ticket` comprueba antes, sin gastar nada, que el usuario no tenga ya un ticket abierto (responde con el enlace) y que haya algo que contar (una conversación o una descripción). Después pasa por las mismas comprobaciones que un mensaje: aviso aceptado, cupo diario, límite por minuto y una generación a la vez. La llamada usa la herramienta `offer_ticket` **forzada** (`tool_choice`) y sin streaming.

## Configurar el servidor

El asistente puede cambiar los ajustes del dashboard si se lo pides («activa el Anti-Bots y sube el umbral de mayúsculas a 80»). Se construye sobre el registro de ajustes (`src/lib/db/settings.ts`) y el mismo `changeSetting` del autoguardado, así que valen las mismas reglas y límites. Código en `src/lib/chat/dashboard.ts` (y `commands.ts` para los comandos).

**Qué servidor (sin confusiones).** El servidor se elige **por conversación** (`conversation_guild` en `chat.db`, con `/servidor`); una conversación nueva no hereda el de otra. Si el usuario solo administra uno con SP Agency dentro, se usa ese (no hay confusión posible). Con varios y sin elegir, cuando pide cambiar algo el asistente **no adivina ni llama al modelo**: pregunta «¿en cuál lo hago?» con un botón por servidor (evento SSE `servers`) y, al elegir, la web repite la petición original. Las preguntas de «cómo se hace» (`isHowTo`: «¿cómo activo…?») se contestan con la documentación sin pedir servidor. La elección **no da permiso**: se vuelve a comprobar contra Discord (administrador + bot dentro, con la caché de 1 min del dashboard) cada vez que se usa.

**Dónde se aplica, siempre a la vista.** El servidor aparece: en una línea fija sobre el cuadro de mensaje («Servidor de esta conversación: …»), al final de cada respuesta con cambios («Servidor: …», lo añade la web aunque el modelo lo olvide), en el asunto y la cabecera de la tarjeta, en el botón («Aplicar en …»), en el aviso previo a confirmar y en el resultado. El modelo también recibe la orden de nombrarlo. La propuesta guarda el **ID** del servidor: si después se cambia de servidor en la conversación, confirmar una propuesta antigua sigue aplicándose donde decía.

**Cuándo lleva contexto.** Solo los mensajes que suenan a ajustes (`wantsSettings`: activa, cambia, pon, umbral, lista blanca, prefijo…, o un mensaje corto tras uno así) reciben un bloque `<ajustes>` con **una línea por ajuste**: `clave=valor [opciones] (rango) # etiqueta` (~400 tokens). El resto de preguntas no pagan nada. Las listas se recortan a 15 elementos. Las dos herramientas (`offer_ticket`, `propose_settings`) van siempre, para no romper el prefijo que cachea el proveedor.

**Flujo.**

1. El modelo llama a `propose_settings({ changes: [{ key, value, op? }] })` con las claves exactas del bloque. Solo se atiende la primera llamada de la respuesta.
2. La web lo valida (`buildSettingsProposal`): clave en el registro, valor con su tipo y límites, como máximo 8 cambios. Lo que ya estaba como se pide, o no vale, se **descarta y se explica** en el mensaje («No he incluido: …»). El modelo no recibe una segunda vuelta para corregirse (costaría otra llamada): el usuario lo ve y lo repite.
3. Se guarda una **propuesta** (`proposals`, `kind = 'settings'`, con el servidor y los cambios ya normalizados en `payload`; caduca a **1 hora**, no a 24 como los tickets: la configuración puede haber cambiado). La tarjeta muestra el antes → después de cada ajuste.
4. `POST /api/chat/proposals/:id` con `confirm`: comprueba que la propuesta es del usuario, que sigue siendo administrador del servidor (`requireGuildApi`), vuelve a validar el `payload` y aplica los cambios **uno a uno y en orden** con `changeSetting`. Nada de lo que llega en el cuerpo decide qué se cambia.
5. Cada cambio queda en la auditoría (`data/audit.db`) con `source = 'assistant'` y el usuario que confirmó. El resultado (qué se aplicó y qué falló, con el motivo) se añade a la conversación como nota. Si la base no responde a ningún cambio, la propuesta vuelve a estar pendiente.

El Modo Pánico va acompañado de su fecha de activación igual que desde el dashboard (ver [`dashboard.md`](dashboard.md)).

**Lo que no hace:** editar listas enteras (solo añadir o quitar un elemento), nombres en vez de IDs de canales y roles (el modelo pide el ID), ni nada fuera del registro: copias de seguridad, restablecer la configuración o expulsar al bot siguen sin existir (necesitan endpoints del bot).

## Base de conocimiento: `pnpm knowledge`

Genera `knowledge/*.md` (no se sube a git) con la web en Markdown, leyendo las **mismas fuentes que pintan las páginas**, así que no hay nada que mantener a mano:

| Origen | Cómo |
| :----- | :--- |
| Docs (`src/lib/docs`) | Se convierten los bloques a Markdown. |
| Home (`home-content.ts`, `steps.ts`, `site.ts`) | Idem. |
| Dashboard (`src/pages/dashboard/[guildId]/*.astro`) | Se extraen `SettingCard`, `Toggle`, `FieldRow` y sus opciones del propio marcado. |
| Resto de páginas públicas (`src/pages/**/*.astro`) | **Se descubren solas**: se recorre `src/pages` y cada `.astro` genera un `page-<ruta>.md` con su título, descripción y el texto de su marcado (títulos, párrafos, listas, tablas). Una página nueva entra sin tocar el script. Se saltan `api/`, `auth/`, `staff/`, `verify/`, `dashboard/`, `docs/`, `changelog/admin`, `404`, las rutas dinámicas (`[…]`) y las URLs que ya generan las otras fuentes; para excluir una página a mano, `export const knowledge = false;` en su cabecera. Solo entra el texto escrito en el propio marcado: lo que una página pinta desde datos o componentes ajenos no. |
| Changelog | No pasa por aquí: vive en SQLite y se lee en vivo (cada 5 min). |

Se ejecuta solo antes de `pnpm dev` y `pnpm build` (`predev` / `prebuild`), y a mano con `pnpm knowledge`. También genera `_sitemap.md` (título y ruta de cada página), que va en el prompt de sistema. Si se añade una página o un ajuste nuevo, aparece con el siguiente arranque.

El buscador recarga el índice si cambian los archivos, sin reiniciar el servidor.

## Cupo diario

Se mide en **unidades ponderadas** (`usage.ts`): entrada nueva = 1, entrada cacheada = 0,1, salida = 4. Cada llamada al modelo suma, además de las unidades, sus tokens de entrada, de caché y de salida y el nº de llamadas (tabla `usage_daily`), que es lo que detalla `/usage`. Así el contexto cacheado casi no cuenta y la salida (lo caro) sí. Por defecto 100.000 al día (`CHAT_DAILY_TOKEN_LIMIT`), con reinicio a medianoche de Madrid. Vive en su propia tabla: borrar una conversación **no** devuelve cupo.

## Tickets

El modelo dispone de la herramienta `offer_ticket(subject, summary)`. Al llamarla se guarda una **propuesta** (caduca a las 24 h) y la interfaz muestra una tarjeta. Al confirmar, `POST /api/chat/proposals/:id` abre el ticket con el mismo `createTicket` que usa `/support` (mismos límites y errores: un ticket abierto por usuario, etc.).

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

- Nombres de canales y roles en vez de IDs (comparte pendiente con el dashboard).
- Deshacer el último cambio del asistente (la auditoría guarda el valor anterior; falta el comando).
- Cambiar `CONSENT_VERSION` cuando cambie el texto del aviso (`pages/support/assistant.astro`) para volver a pedir la aceptación. Ya se subió al añadir la configuración del servidor: el aviso dice que los ajustes se envían al proveedor de IA.
