# Docs — lo que la web necesita del bot

Esta carpeta es el equivalente web de `docs/` del bot (`bots/SPAgency/docs`). Cada documento describe **una funcionalidad de la web que depende del bot**: el contrato entre los dos (rutas, errores, variables de entorno) y **qué tiene que implementar el bot** para que la web funcione. El bot es siempre la autoridad; la web es un cliente autenticado.

Así los dos repos no se desincronizan: si cambia una ruta o un error, se cambia aquí primero.

## Convenciones (las mismas que `verification.md` del bot)

- **REST directo entre servicios**, no la base de datos como puente: la DB es persistencia, no un canal entre procesos.
- **El bot escucha solo en `127.0.0.1`** (bot y web comparten VPS). Nunca se expone al navegador.
- **Autenticación con `Authorization: Bearer <clave>`**, comparada en tiempo constante. Una sola clave compartida (`INTERNAL_API_KEY`) para todo el tráfico entre los dos procesos, en ambos sentidos: identifica **quién llama**, no qué funcionalidad usa, y no aporta separación tener varias porque los dos `.env` las guardan todas. Nunca visible para el navegador. Lo único que sí va aparte es lo que la web **no** debe poder hacer: `VERIFICATION_SECRET`, con el que el bot firma los tokens, no sale del bot.
- **La identidad del usuario la pone la web**, a partir de su sesión de Discord — nunca el navegador. El bot se fía del `userId` que recibe porque la petición viene autenticada de servidor a servidor.
- **Un recurso ajeno responde igual que uno inexistente** (`404`), para no revelar qué IDs existen.
- **Fallar del lado restrictivo**: ante la duda, se deniega.

## Índice

| Funcionalidad | Documento | Contrato | Bot | Web |
| :------------ | :-------- | :------- | :-- | :-- |
| Soporte (tickets) | [`support.md`](support.md) | definido | pendiente | hecha |
| Verificación de miembros | [`verification.md`](verification.md) | en el bot: `bots/SPAgency/docs/verification.md` | hecho | hecha |
| Asistente de IA | [`assistant.md`](assistant.md) | — (solo web; usa el de soporte para los tickets) | — | hecha |

El contrato de la verificación (token, rutas, errores) está en el bot: `bots/SPAgency/docs/verification.md`.
