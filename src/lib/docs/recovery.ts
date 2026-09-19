import type { DocPage } from "./types";

export const recovery: DocPage[] = [
	{
		slug: "recuperacion",
		title: "Recuperación tras un raid",
		summary: "Deshaz el daño con /unnuke y restaura tu servidor con una copia de seguridad.",
		icon: "bi-arrow-counterclockwise",
		blocks: [
			{
				type: "p",
				text: "Ninguna detección es perfecta: por rápido que sea el Anti-Raid, un atacante puede llegar a crear canales, roles o emojis antes de que lo frene. Por eso SP Agency incluye dos herramientas para **deshacer el daño después**.",
			},
			{
				type: "callout",
				tone: "info",
				title: "Solo para el propietario",
				text: "`/unnuke` y `/backup` los puede usar únicamente el propietario del servidor y exigen permiso de Administrador. Ambos piden confirmación antes de ejecutarse y dejan su rastro en los [registros](/docs/registros).",
			},
			{ type: "h", text: "/unnuke: limpiar lo que dejó el raid" },
			{
				type: "table",
				head: ["Comando", "Qué hace"],
				rows: [
					["`/unnuke channels`", "Elimina canales **duplicados por nombre**."],
					["`/unnuke roles`", "Elimina roles duplicados por nombre."],
					["`/unnuke emojis`", "Elimina emojis duplicados por nombre."],
					["`/unnuke bans`", "**Desbanea a todos** los usuarios baneados actualmente."],
				],
			},
			{
				type: "callout",
				tone: "warning",
				title: "Cuidado con /unnuke bans",
				text: "Desbanea a todo el mundo, incluidos los baneos que hiciste tú a propósito. Úsalo cuando un raider haya baneado en masa a tus miembros, y revisa después quién debía seguir baneado.",
			},
			{ type: "h", text: "/backup: una copia del servidor" },
			{
				type: "p",
				text: "Una copia de seguridad es una foto de tu servidor en un momento concreto. Incluye **canales, roles, baneos, emojis y stickers**. También puedes crearla desde **Ajustes → Copias de seguridad → Crear backup ahora** en el dashboard.",
			},
			{
				type: "table",
				head: ["Comando", "Qué hace"],
				rows: [
					["`/backup create`", "Guarda una copia. Solo hay **una copia por servidor**: crear otra sustituye a la anterior (te lo pregunta antes)."],
					["`/backup info`", "Muestra qué contiene la copia guardada y cuándo se hizo."],
					["`/backup load`", "Restaura **solo lo que falta** desde la copia. Antes te ofrece limpiar los duplicados de un raid."],
					["`/backup delete`", "Elimina la copia guardada."],
				],
			},
			{
				type: "list",
				items: [
					"Restaurar puede tardar un poco: las imágenes se descargan de una en una para no saturar a Discord.",
					"Al restaurar, SP Agency no se autobanea: el Anti-Raid ignora lo que hace el propio bot.",
					"Haz la copia cuando el servidor esté como quieres, y renuévala tras cambios grandes.",
				],
			},
			{ type: "h", text: "Un plan para cuando hay un ataque" },
			{
				type: "list",
				ordered: true,
				items: [
					"Si el ataque sigue en curso, activa el [Modo Pánico](/docs/modo-panico).",
					"Cuando se calme, ejecuta `/unnuke` para los canales, roles y emojis duplicados.",
					"Si falta algo, usa `/backup load` para recuperarlo desde tu copia.",
					"Revisa los [registros](/docs/registros) para saber qué pasó y quién lo hizo.",
				],
			},
		],
	},
	{
		slug: "registros",
		title: "Registros",
		summary: "Qué guarda SP Agency, dónde verlo y cómo evitar que sature tu canal.",
		icon: "bi-journal-text",
		blocks: [
			{
				type: "p",
				text: "SP Agency guarda un historial de todo lo que hace y de lo que ocurre en tu servidor que le afecta a la seguridad. No es una auditoría para leer por curiosidad: registra lo que el bot **usa para proteger**.",
			},
			{ type: "h", text: "Dos tipos de registro" },
			{
				type: "table",
				head: ["Tipo", "Qué responde", "Ejemplos"],
				rows: [
					["**Acciones**", "¿Qué hizo el bot porque alguien se lo pidió?", "Un `/ban`, un `/warn`, restaurar una copia. Siempre con la persona que lo ejecutó."],
					["**Eventos**", "¿Qué pasó en el servidor, lo haga quien lo haga?", "Alguien crea un canal a mano, un raid baneado, un bot expulsado, una infracción de automoderación."],
				],
			},
			{
				type: "p",
				text: "Un comando que haces tú no se registra dos veces: lo que pasa por SP Agency queda como acción, y los eventos cubren solo lo que ocurre fuera del bot.",
			},
			{ type: "h", text: "Qué eventos se registran" },
			{
				type: "list",
				items: [
					"Canales y roles creados, eliminados o editados; webhooks creados; baneos y desbaneos.",
					"Raids detectados, bots expulsados, y todo lo que hace el [Modo Pánico](/docs/modo-panico) (incluida su expiración).",
					"Miembros maliciosos y cuentas falsas detectadas, y quien añadió un bot raider.",
					"Infracciones de [automoderación](/docs/automoderacion) y webhooks eliminados por flood.",
					"Avisos del propio sistema, como el Anti-Raid desactivándose por falta de permisos.",
				],
			},
			{
				type: "p",
				text: "SP Agency **no registra mensajes borrados o editados**: un mensaje borrado no cambia ninguna decisión de seguridad.",
			},
			{ type: "h", text: "Dónde verlos" },
			{
				type: "list",
				items: [
					"**En el dashboard**, en **Registros de actividad**, con filtros por Seguridad, Automod, Sistema y Administración.",
					"**En un canal de Discord**, si configuras uno en **Alertas y Canales → Canal de logs**.",
				],
			},
			{
				type: "p",
				text: "Todo se guarda **siempre**, tengas canal o no. El canal solo sirve para verlo en directo. Los mensajes van en el idioma configurado para tu servidor.",
			},
			{ type: "h", text: "Sin inundar el canal" },
			{
				type: "p",
				text: "Un raid puede generar decenas de eventos en segundos. Para no reventar los límites de Discord, SP Agency envía como máximo **3 mensajes cada 10 segundos** por servidor; lo que sobra se agrupa (hasta 10 por mensaje) y se envía en cuanto hay hueco.",
			},
			{
				type: "callout",
				tone: "warning",
				title: "Si el canal de logs falla",
				text: "Si SP Agency no puede escribir en el canal (lo borraste o perdió el permiso), **lo desconfigura** en lugar de insistir contra un destino roto, y deja un aviso en el historial. Configura un canal nuevo en **Alertas y Canales** para volver a verlos.",
			},
		],
	},
];

export const help: DocPage[] = [
	{
		slug: "preguntas-frecuentes",
		title: "Preguntas frecuentes",
		summary: "Respuestas rápidas a las dudas más habituales.",
		icon: "bi-question-circle",
		blocks: [
			{ type: "h", text: "El Anti-Raid ya no reacciona" },
			{
				type: "p",
				text: "Lo más probable es que se haya desactivado solo porque el bot perdió un permiso o quedó otro rol por encima del suyo. Mira el aviso en los [registros](/docs/registros), corrígelo y vuelve a activarlo. Ver [Permisos y jerarquía](/docs/permisos).",
			},
			{ type: "h", text: "¿Puedo cambiar cuántas acciones activan el Anti-Raid?" },
			{
				type: "p",
				text: "No: los límites (3 acciones en 10 segundos) son fijos. Puedes activar o desactivar el Anti-Raid y eximir a alguien con la lista blanca. Para bloquear más fuerte durante un ataque, usa el [Modo Pánico](/docs/modo-panico).",
			},
			{ type: "h", text: "¿Se puede eximir a alguien de todo?" },
			{
				type: "p",
				text: "La lista blanca exime del [Anti-Raid](/docs/anti-raid). Nunca exime del [Modo Pánico](/docs/modo-panico) ni de la regla de baneo a quien añade un bot raider, a propósito.",
			},
			{ type: "h", text: "Han baneado a un administrador que añadió un bot" },
			{
				type: "p",
				text: "Es la regla de [quien añade un bot raider](/docs/anti-raid#quien-anade-un-bot-raider): si un bot se banea por raider, se banea también a quien lo autorizó, sea staff o no. Puedes desbanearlo con `/unban`.",
			},
			{ type: "h", text: "Estoy en la lista de UBFB y creo que es un error" },
			{
				type: "p",
				text: "Usa `/apelar`, que te indica dónde presentar tu apelación. Con `/me` puedes comprobar tu estado.",
			},
			{ type: "h", text: "¿El Modo Pánico se apaga solo?" },
			{
				type: "p",
				text: "Sí, pasado el tiempo que hayas configurado (por defecto, 1 día). También puedes apagarlo antes desde el dashboard.",
			},
			{ type: "h", text: "¿Qué idioma usa el bot?" },
			{
				type: "p",
				text: "Español o inglés. Se elige en **Ajustes → Idioma** y afecta a las respuestas, los registros y los avisos del servidor.",
			},
			{ type: "h", text: "¿Necesitas más ayuda?" },
			{
				type: "p",
				text: "Escríbenos desde la página de **Soporte**. Si estás en plena emergencia, `/sos` avisa al equipo de SP Agency al momento.",
			},
		],
	},
];
