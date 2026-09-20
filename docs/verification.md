# Verificación — lado web

Contrato completo (token, rutas del bot, errores) en el bot: `bots/SPAgency/docs/verification.md`. Aquí solo lo que hace la web.

> **Estado:** bot y web implementados.

## Flujo

1. Alguien entra a un servidor con verificación activa. El bot le manda un DM con `<VERIFICATION_WEB_URL>/<token>` (en la web: `/verify/<token>`).
2. **La página pregunta al bot** (`GET /verify/:token`) a quién pertenece el token. Si es inválido o ha caducado (15 min), muestra "Enlace no válido" y **no** manda a iniciar sesión.
3. Si no hay sesión, salta el OAuth de Discord y vuelve a la misma página (`?next=`).
4. **Se exige que la cuenta de la sesión sea la del token.** Es lo que demuestra que el enlace lo abre quien lo recibió. Si no coincide: "Esta no es tu cuenta".
5. Captcha (Cloudflare Turnstile). El botón "Verificarme" solo se activa con el captcha resuelto.
6. `POST /api/verify/complete` (`{ token, captcha }`). En el servidor, en este orden: sesión → identidad del token contra la cuenta → captcha validado con la clave secreta → `POST /verify/:token/complete` al bot, que concede el rol.

## Decisiones

- **La web nunca descifra el token.** Lo firma el bot con `VERIFICATION_SECRET`, que la web no tiene: una web comprometida solo podría completar tokens que el bot ya emitió, no fabricar verificaciones.
- **La identidad la pone el servidor,** a partir de la sesión de Discord, nunca el navegador. El token se vuelve a consultar al bot en cada intento.
- **Falla cerrado:** sin las claves de Turnstile la página responde "no disponible" y la API 503. Mejor no verificar a nadie que hacerlo sin captcha.
- **El token de la URL es una credencial:** la página se sirve con `Cache-Control: no-store` y `Referrer-Policy: no-referrer` (el script del captcha es de un tercero y, si no, recibiría la URL en `Referer`), y con `noindex`.
- **Errores:** `400 invalid_token`, `403 wrong_account`, `400 invalid_captcha`, `409 not_configured` (verificación desactivada entre el DM y el clic), `502 grant_failed` (el bot no pudo dar el rol), `503` (bot o captcha no disponibles). Cada uno con su mensaje en español.
- El nombre e icono del servidor (`GET /guilds/:id` con el token del bot) son solo cosméticos: si fallan, la página sigue sin ellos.

## Variables de entorno (web)

- `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` — captcha de Cloudflare. En local sirven las claves de prueba de Cloudflare (siempre pasan; ver `.env.example`). En producción, un widget real.
- `BOT_API_URL`, `INTERNAL_API_KEY` — los mismos que usa soporte.
- `DISCORD_BOT_TOKEN` — opcional aquí, para mostrar el nombre del servidor.

Y en el bot, `VERIFICATION_WEB_URL` tiene que apuntar a la URL pública de esta página (`https://<dominio>/verify`).

## Pendiente

- El interruptor "Requerir verificación" del dashboard trabaja con datos de ejemplo y no guarda nada todavía: hoy `verificationEnable` / `verificationRole` solo se pueden cambiar en la base de datos del bot.
