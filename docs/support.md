# Soporte — tickets web ↔ Discord

Un usuario abre un ticket desde la web; el ticket aparece como un canal en el servidor de Discord de SPAgency; el staff responde en Discord y lo que escribe se ve en la web; el usuario contesta desde la web y llega al canal. Al cerrar, queda un **transcript** que el usuario puede consultar desde la web y el ticket **no se puede retomar**.

> **Estado:** contrato definido. Web: implementada. Bot: pendiente (ver [checklist del bot](#qué-tiene-que-implementar-el-bot)).

## Filosofía

1. **Discord es el almacén del ticket abierto; el bot no usa base de datos para esto.** Los mensajes viven en el canal, y el bot solo cachea en memoria (mismo criterio cache-first que el resto de sus sistemas). Si el bot se reinicia, relee el canal.
2. **La web guarda los transcripts, no el bot.** Un transcript es un dato del usuario que la web sirve; vive en el SQLite de la web. El bot no necesita recordar nada de un ticket cerrado.
3. **El usuario no entra a Discord.** Su interfaz es la web. No se le da acceso al canal.
4. **Nunca se pierde un transcript, y no caduca.** El canal solo se borra cuando la web confirmó haberlo guardado, y la web conserva los transcripts **para siempre** (no hay retención ni borrado automático).
5. **El navegador nunca habla con el bot.** Va navegador → web → bot, y la web pone la identidad.

## El flujo

1. **Crear.** El usuario (con sesión de Discord en la web) escribe asunto y mensaje. La web llama `POST /support/tickets`. El bot crea un canal en la categoría de soporte y publica el mensaje inicial.
2. **Conversar.** La web consulta cada ~3 s `GET /support/tickets/:id/messages?after=<cursor>` y pinta lo nuevo. Lo que el staff escribe en el canal llega así. Lo que el usuario escribe va por `POST /support/tickets/:id/messages` y el bot lo publica en el canal.
3. **Cerrar.** Cierra el staff (botón o `/ticket close` en el canal) o el usuario (`POST /support/tickets/:id/close`). El bot bloquea el canal, construye el transcript y **lo empuja a la web** (`POST <web>/api/support/transcripts`). Con la confirmación de la web sube la copia del staff, avisa al usuario por DM y borra el canal.
4. **Consultar.** El usuario ve sus transcripts en la web (solo lectura). No hay forma de reabrir: el canal ya no existe.

## Canal del ticket

- **Categoría:** `SUPPORT_CATEGORY_ID`. Discord admite **50 canales por categoría**: con un solo ticket abierto por usuario alcanza de sobra; si se llena, `503 support_full`.
- **Nombre:** `ticket-<primeros 6 caracteres del ticketId>`.
- **Permisos:** `@everyone` sin ver; ven y escriben el bot y el rol `SUPPORT_STAFF_ROLE_ID` (`1055967318485762140`). Nadie más.
- **Tema (topic):** se escribe **una sola vez**, al crear (Discord limita las ediciones de tema/nombre a 2 cada 10 minutos), con formato estricto y legible por máquina:

  ```
  ticket:<ticketId> user:<userId>
  ```

  Es el "índice" del ticket: para saber los tickets de un usuario el bot recorre los canales de la categoría (ya están en su caché) y parsea el tema. Un canal de la categoría cuyo tema no encaje se ignora.
- **Mensaje inicial:** lo publica el bot con asunto, nombre y ID del usuario, y un botón **Cerrar ticket** (solo el staff puede pulsarlo).

## `ticketId`

16 bytes aleatorios de `crypto.randomBytes`, en base64url. Opaco y no secuencial: no se puede adivinar ni enumerar. Aun así **cada ruta comprueba que el ticket pertenece al `userId`** recibido; si no, `404`.

## Qué mensajes se reflejan

El bot normaliza cada mensaje del canal a `{ id, author, name, avatar, content, at }`:

- **`author: "staff"`** — mensaje de un miembro con el rol de staff, sin contar los que empiezan por `//`.
- **`author: "user"`** — mensaje que el propio bot publicó a petición de la web (embed con el nombre y avatar del usuario y una marca de origen, p. ej. el footer `web`).
- **Se ignora todo lo demás:** mensajes de otros bots, mensajes de sistema, los del propio bot que no sean del usuario (mensaje inicial, avisos), y usuarios sin el rol.

Reglas de contenido:

- **Notas internas:** un mensaje de staff que empieza por `//` **no** se refleja en la web ni entra en el transcript del usuario. Sí aparece en la copia del staff.
- **Sin menciones crudas:** `<@id>`, `<@&id>` y `<#id>` se sustituyen por texto legible (`@nombre`, `@rol`, `#canal`) y los emojis personalizados `<:nombre:id>` por `:nombre:`. La web no resuelve IDs.
- **Adjuntos:** no se reflejan en esta versión. Un mensaje con archivo se envía con el texto que tenga y, si lo hay, un marcador `[archivo adjunto no disponible en la web]`.
- El `content` es el markdown de Discord tal cual; **la web lo sanea y lo pinta**, el bot no manda HTML.
- Ediciones y borrados en Discord **no** se sincronizan.

## Cursor y caché

El cursor `after` es el **ID de mensaje de Discord** (snowflake, creciente): sirve tal cual, sin numerar nada.

El bot mantiene por ticket un búfer en memoria (unos 200 mensajes) alimentado por el evento de mensaje nuevo. Si `after` es más antiguo que el búfer, o el bot acaba de reiniciarse, relee el canal de Discord con el mismo normalizador. Así el camino caliente del polling no toca la red.

## API del bot — `SupportServer`

Mismo servidor `node:http` y mismo puerto que la API de verificación (`VERIFICATION_SERVER_PORT`, `127.0.0.1`), bajo `/support/*`. Todas las rutas exigen `Authorization: Bearer <SUPPORT_API_KEY>` (`401` si falta o es incorrecta). Cuerpos y respuestas en JSON.

### `POST /support/tickets` — crear

Cuerpo: `{ userId, username, avatarUrl, subject, message }`. `subject` ≤ 100 caracteres, `message` ≤ 2000, ambos no vacíos tras recortar espacios.

- `201 { ticketId, createdAt }`
- `400 invalid_body`
- `429 too_many_open_tickets` — el usuario ya tiene un ticket abierto (máximo **uno** a la vez; hasta que se cierre no puede abrir otro).
- `429 cooldown` — creó otro ticket hace menos de 60 s.
- `503 support_full` — la categoría no admite más canales.
- `502` — el bot no pudo crear el canal (permisos, límite de Discord). Error genérico.

### `GET /support/tickets?userId=` — tickets abiertos del usuario

- `200 { tickets: [{ ticketId, subject, createdAt }] }` — como máximo uno por el límite de tickets abiertos, pero se devuelve como lista para poder cambiar el límite sin romper el contrato.

### `GET /support/tickets/:ticketId/messages?userId=&after=` — mensajes nuevos

`after` es opcional (sin él, devuelve desde el principio). Como máximo 50 mensajes por llamada, en orden ascendente; si hay más, la web vuelve a llamar con el último `id`.

- `200 { messages: [{ id, author, name, avatar, content, at }] }` (`at` en ISO 8601)
- `404 not_found` — no existe **o no es del usuario** (indistinguible a propósito). La web lo interpreta como ticket cerrado y lleva al usuario a su historial.

### `POST /support/tickets/:ticketId/messages` — el usuario escribe

Cuerpo: `{ userId, content }`, `content` ≤ 2000. El bot lo publica en el canal como embed del usuario **con menciones desactivadas** (`allowedMentions` vacío, y se neutraliza `@everyone`/`@here`).

- `200 { id }`
- `400 invalid_body`, `404 not_found`
- `429 cooldown` — más de un mensaje cada 2 s.

### `POST /support/tickets/:ticketId/close` — el usuario cierra

Cuerpo: `{ userId }`. Responde en cuanto empieza el cierre; el transcript se entrega aparte (ver más abajo).

- `202 { closing: true }`
- `404 not_found`

## Cierre y transcript

Da igual quién cierre (staff o usuario), el proceso es el mismo:

1. **Bloquear** el canal (se deniega enviar mensajes) y marcarlo como cerrando, para que no entren más mensajes ni un segundo cierre. Una vez cerrado, el ticket nunca se reabre.
2. **Leer el historial completo** del canal (paginando de 100 en 100).
3. **Construir dos versiones:**
   - **Del usuario:** solo `staff` y `user`, sin notas internas ni mensajes del bot.
   - **Del staff:** todo lo anterior más las notas internas `//`, como archivo de texto.
4. **Empujar la del usuario a la web**: `POST <SUPPORT_WEB_URL>/api/support/transcripts` con `Authorization: Bearer <SUPPORT_WEB_API_KEY>` y este cuerpo:

   ```json
   {
     "ticketId": "…",
     "userId": "…",
     "subject": "…",
     "openedAt": "2026-09-20T10:00:00.000Z",
     "closedAt": "2026-09-20T10:30:00.000Z",
     "closedBy": "user",
     "messages": [{ "id": "…", "author": "staff", "name": "…", "avatar": "…", "content": "…", "at": "…" }]
   }
   ```

   La web responde `200` (o `401` si la clave no coincide, `400` si el cuerpo no es válido, `413` si pesa más de 5 MB). Es **idempotente por `ticketId`**: repetir el envío no duplica nada. Un `4xx` no se reintenta: indica un fallo del bot, no de disponibilidad.

   Esta ruta es solo para el bot: en el proxy inverso conviene restringir `/api/support/transcripts` a `127.0.0.1`.
5. **Solo tras la confirmación de la web:** subir la copia del staff a `SUPPORT_TRANSCRIPTS_CHANNEL_ID`, mandar un DM al usuario (avisando de que puede verlo en la web; si tiene los DMs cerrados, se ignora sin más) y **borrar el canal**.
6. **Si la web no confirma** (caída, error): reintentar con espera creciente (5 s, 30 s, 5 min…). El canal **se queda bloqueado y sin borrar**; si tras los reintentos sigue sin entregarse, se sube igualmente la copia del staff y se registra en `STAFF_LOGS_CHANNEL` para actuar a mano. Al arrancar, el bot retoma los canales marcados como cerrando.

## Anti-abuso

| Límite | Valor por defecto |
| :----- | :---------------- |
| Tickets abiertos por usuario | 1 |
| Cooldown entre creaciones de ticket | 60 s |
| Cooldown entre mensajes de un mismo usuario | 2 s |
| Longitud del asunto / de un mensaje | 100 / 2000 caracteres |

## Variables de entorno

**Bot:**
- `SUPPORT_API_KEY` — autentica a la web contra `/support/*`.
- `SUPPORT_CATEGORY_ID` — categoría donde se crean los canales.
- `SUPPORT_TRANSCRIPTS_CHANNEL_ID` — canal del staff con las copias.
- `SUPPORT_STAFF_ROLE_ID` — rol del staff (`1055967318485762140`).
- `SUPPORT_WEB_URL` — base de la web (p. ej. `http://127.0.0.1:4321`).
- `SUPPORT_WEB_API_KEY` — autentica al bot contra la web al empujar transcripts.

**Web (este repo):**
- `SUPPORT_BOT_URL` — API del bot (p. ej. `http://127.0.0.1:4501`).
- `SUPPORT_API_KEY` — la misma que el bot espera.
- `SUPPORT_WEB_API_KEY` — la misma que el bot envía al entregar transcripts.
- `SUPPORT_DB_PATH` — opcional, archivo SQLite de los transcripts (por defecto `data/support.db`). En producción, en un disco que persista: los transcripts se guardan para siempre.

Las tres claves son largas y aleatorias y nunca llegan al navegador.

## Qué tiene que implementar el bot

- [ ] `SupportServer`: rutas `/support/*` colgadas del servidor HTTP existente, con la autenticación por clave y los códigos de arriba.
- [ ] Creación del canal (categoría, permisos, tema `ticket:<id> user:<id>`, mensaje inicial con botón de cerrar).
- [ ] Índice de tickets por usuario recorriendo la categoría en caché y parseando el tema; comprobación de propiedad en cada ruta.
- [ ] Normalizador de mensajes (`staff` / `user` / ignorar), conversión de menciones y emojis, y marcador de origen web.
- [ ] Búfer por ticket alimentado por el evento de mensaje, con relectura del canal como respaldo.
- [ ] Publicación de mensajes del usuario como embed, sin menciones.
- [ ] Notas internas `//`.
- [ ] Cierre: bloqueo, transcript en dos versiones, envío a la web con reintentos, copia al canal del staff, DM y borrado; reanudación de cierres pendientes al arrancar.
- [ ] Botón **Cerrar ticket** y `/ticket close`, solo para el staff.
- [ ] Límites y cooldowns de la tabla anterior.

## Qué hace la web (contexto)

- `/support`: información y acceso; con sesión, su ticket abierto (o el formulario para crear uno) y el historial. Sin sesión lleva al login de Discord y vuelve a `/support`.
- `/support/tickets/<id>`: la conversación, con consulta cada ~3 s y contenido saneado. Si el bot responde `404` (ticket ya cerrado), lleva al transcript.
- `/support/history/<id>`: transcript de solo lectura.
- `POST /api/support/transcripts`: recibe lo que empuja el bot, valida la clave y guarda en su SQLite (`upsert` por `ticketId`).
- `/api/support/tickets/*`: proxy autenticado hacia el bot para el navegador. La identidad sale de la sesión de Discord, nunca del cuerpo, y las claves no salen del servidor.
- Si el bot no responde: aviso "soporte no disponible" con el enlace al Discord, sin encolar nada.
