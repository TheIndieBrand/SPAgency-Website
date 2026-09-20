# Dashboard y base de datos

La dashboard **lee y escribe la misma base de Postgres que el bot** (la configuración de cada servidor y sus registros). El bot sigue siendo la autoridad: crea las filas de un servidor al entrar en él, lleva las migraciones y reacciona a los cambios. La web solo consulta y actualiza ajustes.

> **Estado:** lectura y escritura hechas en General, Anti-Raid & Bots, Automoderación, Alertas y Ajustes; Registros en lectura. Pendiente: nombres en vez de IDs, copias de seguridad y zona de peligro (necesitan al bot), paginación de registros.

## Cómo llega un cambio al bot

`UPDATE` en `guild_protection`, `guild_moderation`, `guild_configuration` o `guilds` → un trigger de Postgres hace `pg_notify('guild_config_changed', <guild_id>)` → el bot (`GuildConfigCache`, `RaidmodeExpiry`) invalida su caché o reprograma. La web **no avisa de nada** al bot: la base es el canal, tal como se diseñó en el bot (`docs/antiraid.md`, sección 2).

## Conexión (`src/lib/db/client.ts`)

- `DATABASE_URL` (ver `.env.example`). Rol **`spagency_web`**, con lo mínimo:

  | Tabla | Permisos |
  | :---- | :------- |
  | `guilds` | `SELECT`; `UPDATE (language, prefix)`; `INSERT (id, owner_id)` |
  | `guild_protection`, `guild_moderation`, `guild_configuration` | `SELECT`, `UPDATE`; `INSERT (guild_id)` |
  | `server_event_logs`, `bot_action_logs`, `warns` | `SELECT` |
  | `backups` | `SELECT (guild_id, created_at)` |

  El `INSERT` es solo para crear las filas de un servidor (ver más abajo); no puede insertar registros ni avisos, ni `DELETE`, ni DDL, y no puede leer el contenido de las copias de seguridad.
- Postgres solo escucha en `localhost` de la VPS. En producción la web entra por `127.0.0.1:5432`; en desarrollo, por un túnel SSH (`ssh -N -L 15432:127.0.0.1:5432 usuario@vps`).
- **La base va en UTC** (`ALTER DATABASE spagency SET timezone TO 'UTC'`). Las columnas `timestamp` no llevan zona; con el reloj del servidor en `Europe/London`, `defaultNow()` habría guardado hora local frente a UTC de las fechas escritas desde JS. La web lee todas las fechas como UTC (`isoUtc`).
- Las migraciones las aplica el bot (`pnpm db:migrate` en su repo).

## Creación de la configuración de un servidor

El bot crea las cuatro filas de un servidor cuando *entra* en él (`guildCreate` → `findOrCreate`). Un servidor donde el bot ya estaba antes de existir la base, o al que se unió mientras estaba apagado, no las tiene. Para no depender de eso, la dashboard las **crea sola la primera vez que un administrador abre ese servidor** (`loadOrCreateGuildConfig`), y solo después de comprobar que es administrador y que el bot está dentro:

- Con los valores por defecto de la base (los mismos que usa el bot). Solo inserta `id` y `owner_id`, o `guild_id`: el resto lo rellenan los `DEFAULT`.
- `owner_id` sale de Discord (`GET /guilds/{id}` con el token del bot), no del usuario que abre la página.
- `ON CONFLICT DO NOTHING`: si el bot las crea a la vez, no se pisan; un servidor a medias se completa sin tocar lo que ya hay.

Ojo: esto no sustituye al bot. Las protecciones leen esas filas en el bot, así que en un servidor que nadie ha abierto en el dashboard siguen sin existir hasta que el bot las cree; para eso el bot debería sincronizar sus servidores en `ready`.

## Lectura

`loadGuildConfig(guildId)` une las cuatro tablas de configuración. Si no se pueden leer ni crear las filas, o la base no responde (`unavailable`), la página se sustituye (`Astro.rewrite`) por `/dashboard/unavailable`, con estado 503 y "Reintentar".

## Escritura

`PATCH /api/dashboard/<servidor>/settings` con `{ key, value }`, o `{ key, op: "add" | "remove", value }` para listas.

1. **Acceso** (`requireGuildApi`): sesión válida, administrador del servidor y bot dentro. Content-Type JSON obligatorio (anti-CSRF). La comprobación con Discord se recuerda 1 minuto; si la caché niega el acceso se vuelve a preguntar a Discord (con un mínimo de 3 s), para que quien acaba de recibir permisos o de invitar al bot no espere.
2. **Registro de ajustes** (`src/lib/db/settings.ts`): fuente única de qué se puede cambiar, con tabla, columna, tipo y límites. La clave del cliente **solo elige una entrada del registro**; nombres de tabla y columna no vienen nunca del navegador y todos los valores van parametrizados. Tipos: booleano, opción, entero, duración (`30d`, mismo formato que el parser del bot), ID de Discord y texto; las listas se cambian de elemento en elemento (`array_append` / `array_remove`), no enteras, para no pisar cambios concurrentes.
3. **Reglas entre ajustes**: la verificación no se activa sin rol, y el rol no se quita con la verificación activa.
4. **Modo Pánico**: al encenderlo se fija `raidmode_activated_at` (UTC) y al apagarlo se pone a `NULL`. El auto-apagado del bot (`RaidmodeExpiry`) se programa a partir de esa fecha: sin ella el modo no se apagaría nunca. Volver a encenderlo no reinicia la cuenta atrás.
5. **Auditoría** (`src/lib/audit.ts`, SQLite `data/audit.db`, `AUDIT_DB_PATH`): quién cambió qué, con valor anterior y nuevo. La web no puede escribir en los registros del bot, así que estos cambios quedan aquí.

Códigos de error: `400` petición o ajuste desconocido, `401` sin sesión, `403` sin acceso al servidor, `404` servidor sin configuración, `415` no es JSON, `422` valor no válido (con el motivo en `message`), `503` base no disponible.

## Autoguardado (`src/scripts/dashboard-settings.ts`)

Cada control con `name` guarda al cambiar; los números, también al dejar de teclear (700 ms). Si el servidor rechaza el valor, el control vuelve al último guardado y se muestra el motivo. Los guardados de un mismo ajuste van en cola, de modo que gana el último. Convenciones de marcado: `[data-duration]` (número + unidad), `[data-list]` (chips con `[data-item]` y `[data-remove]`, más `[data-list-input]` / `[data-list-add]`) y `[data-depends]` (deshabilitado mientras ese interruptor esté apagado). El Modo Pánico recarga la página tras guardar para refrescar la barra lateral y su tarjeta.

## Registros y cifras

`listActivity` une `server_event_logs` y `bot_action_logs`. La base guarda el tipo y los datos, no el texto: `describeActivity` (`src/lib/db/activity.ts`) traduce cada tipo a una frase. Un tipo que no conozca se muestra tal cual, para no esconder eventos si el bot es más nuevo que la web. Las cifras de General (`getOverview`) cuentan "hoy" y "ayer" en hora de Madrid.

## Pendiente

- Nombres de canales y roles en lugar de IDs (hay que consultar a Discord con el token del bot).
- Copias de seguridad, restablecer configuración y expulsar al bot: exigen endpoints del bot.
- Registros paginados (hoy, las últimas 200 filas).
- Avisar en la interfaz si el Anti-Raid se apagó solo por falta de permisos (existe el evento `antiraidDisabled`).
