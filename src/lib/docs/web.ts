import type { DocPage } from "./types.ts";

// Cómo se usa la propia web (no el bot): dashboard, asistente y soporte.
export const web: DocPage[] = [
	{
		slug: "dashboard",
		title: "Dashboard",
		summary: "Configura SP Agency desde la web, sin escribir comandos.",
		icon: "bi-speedometer2",
		blocks: [
			{
				type: "p",
				text: "El **Dashboard** es el panel donde ves qué pasa en tu servidor y cambias sus ajustes. Inicia sesión con Discord y elige tu servidor.",
			},
			{ type: "h", text: "Quién puede usarlo" },
			{
				type: "p",
				text: "Solo aparecen los servidores donde eres **administrador** y SP Agency ya está dentro. Si no ves el tuyo, comprueba que el bot está invitado ([Primeros pasos](/docs/primeros-pasos)) y que tienes el permiso de administrador. Un permiso recién concedido o un bot recién invitado se reconocen en cuestión de segundos.",
			},
			{ type: "h", text: "Secciones" },
			{
				type: "table",
				head: ["Sección", "Qué encuentras"],
				rows: [
					["General", "Resumen del estado del servidor y las cifras de hoy y de ayer."],
					["Registros de actividad", "Historial de eventos de seguridad y de acciones de moderación. Ver [Registros](/docs/registros)."],
					["Anti-Raid & Bots", "[Anti-Raid](/docs/anti-raid), [Modo Pánico](/docs/modo-panico), [Anti-Bots](/docs/anti-bots), [selfbots](/docs/selfbots), [miembros maliciosos](/docs/miembros-maliciosos), [verificación](/docs/verificacion) y [SOS](/docs/sos-inteligente)."],
					["Automoderación", "Los filtros de [Automoderación](/docs/automoderacion) y qué pasa al acumular infracciones."],
					["Alertas y Canales", "Canal de logs y lista blanca."],
					["Ajustes", "Idioma y prefijo de comandos. Las copias de seguridad y la zona de peligro aparecen, pero todavía están marcadas como «Próximamente»."],
				],
			},
			{ type: "h", text: "Cómo se guardan los cambios" },
			{
				type: "list",
				items: [
					"**Se guardan solos.** No hay botón de guardar: cada control guarda al cambiarlo (los números, un instante después de dejar de teclear).",
					"Si un valor no es válido, el control vuelve al último valor guardado y se te explica el motivo.",
					"El bot aplica los cambios **al momento**, sin reiniciar nada.",
					"**Cada cambio queda anotado** con tu usuario de Discord, el valor anterior y el nuevo, para poder saber quién cambió una protección.",
				],
			},
			{
				type: "callout",
				tone: "info",
				title: "Si el panel no carga",
				text: "Si no se puede leer la configuración de tu servidor verás una pantalla de «Dashboard no disponible» con un botón para reintentar. Tus ajustes no se pierden.",
			},
			{
				type: "p",
				text: "También puedes pedirle al [Asistente de IA](/docs/asistente-ia) que cambie ajustes por ti: te lo propone y tú lo confirmas.",
			},
		],
	},
	{
		slug: "asistente-ia",
		title: "Asistente de IA",
		summary: "Resuelve dudas sobre el bot y prepara cambios de configuración.",
		icon: "bi-robot",
		blocks: [
			{
				type: "p",
				text: "El asistente contesta dudas sobre SP Agency a partir de esta misma web, y puede proponerte cambios en la configuración de tu servidor. Lo encuentras en la página de [Asistente](/support/assistant); hace falta iniciar sesión con Discord y aceptar un aviso la primera vez.",
			},
			{
				type: "callout",
				tone: "warning",
				title: "Puede equivocarse",
				text: "Es un modelo de IA de un tercero (DeepSeek). Comprueba lo importante en la documentación y no le pases contraseñas, tokens ni datos personales. Qué se guarda y quién lo ve está en el aviso y en la [Política de privacidad](/privacidad).",
			},
			{ type: "h", text: "Cambiar la configuración" },
			{
				type: "p",
				text: "Pídeselo con tus palabras («activa el Anti-Bots» o «sube el umbral de mayúsculas a 80»). El asistente **solo propone**: te muestra una tarjeta con el antes y el después de cada ajuste, y no se aplica nada hasta que pulsas el botón de confirmar. Solo funciona en servidores donde eres administrador, y cada cambio queda anotado con tu usuario.",
			},
			{
				type: "list",
				items: [
					"Si administras **varios servidores**, el asistente te pregunta en cuál antes de hacer nada, y el servidor elegido se muestra siempre sobre el cuadro de mensaje.",
					"Las propuestas **caducan a la hora**: si la configuración cambió mientras tanto, vuelve a pedirlo.",
					"Puede proponer hasta 8 cambios de una vez. Para listas (como la lista blanca) añade o quita un elemento cada vez.",
					"Para canales y roles necesita el **ID** de Discord, no el nombre.",
				],
			},
			{ type: "h", text: "Comandos del chat" },
			{
				type: "p",
				text: "Escribe `/` en el cuadro de mensaje para ver la lista. Ninguno de estos gasta tu cupo diario, salvo `/ticket`.",
			},
			{
				type: "table",
				head: ["Comando", "Qué hace"],
				rows: [
					["`/usage`", "Tu consumo de hoy y lo que te queda."],
					["`/servidor [nombre]`", "Elige el servidor sobre el que actúa el asistente en esa conversación."],
					["`/config [sección]`", "Los ajustes actuales del servidor elegido (protección, automoderación, alertas o general)."],
					["`/panico [on|off]`", "Prepara la propuesta de activar o apagar el [Modo Pánico](/docs/modo-panico), sin esperar al modelo."],
					["`/registros`", "Los últimos 10 eventos del servidor."],
					["`/ticket [descripción]`", "Redacta un ticket para el staff a partir de la conversación (gasta una llamada al modelo)."],
				],
			},
			{ type: "h", text: "Límite diario" },
			{
				type: "p",
				text: "Cada persona tiene un cupo diario de uso que se restablece a medianoche (hora de Madrid) y puede cambiar. Con `/usage` ves cuánto llevas. Cada mensaje admite hasta 1.200 caracteres.",
			},
			{
				type: "p",
				text: "Si no consigue resolver algo, te propone abrir un ticket con el staff ([Soporte y tickets](/docs/soporte)).",
			},
		],
	},
	{
		slug: "soporte",
		title: "Soporte y tickets",
		summary: "Habla con el equipo de SP Agency sin salir de la web.",
		icon: "bi-life-preserver",
		blocks: [
			{
				type: "p",
				text: "Desde [Soporte](/support) abres un ticket con el equipo de SP Agency. Tú lo ves y contestas en la web; el equipo te responde desde Discord y sus mensajes te llegan aquí. No hace falta que entres a ningún canal.",
			},
			{ type: "h", text: "Cómo funciona" },
			{
				type: "list",
				ordered: true,
				items: [
					"Inicia sesión con Discord, escribe un **asunto** y cuéntanos qué pasa.",
					"El ticket se abre y verás la conversación en tiempo real (se actualiza sola).",
					"Contesta desde la web cuando el equipo te responda.",
					"Cuando se resuelve, lo cierras tú o lo cierra el equipo.",
				],
			},
			{
				type: "list",
				items: [
					"Solo puedes tener **un ticket abierto** a la vez: cierra el actual antes de abrir otro.",
					"Al cerrarse, la conversación completa queda en tu **historial** de la web, en solo lectura y sin caducidad. Un ticket cerrado no se reabre: abre uno nuevo.",
					"Los tickets son privados: solo los ven tú y el equipo.",
				],
			},
			{
				type: "callout",
				tone: "tip",
				title: "Antes de abrir un ticket",
				text: "Prueba con el [Asistente de IA](/docs/asistente-ia) o con las [Preguntas frecuentes](/docs/preguntas-frecuentes): muchas dudas se resuelven al momento. Si estás en plena emergencia en tu servidor, `/sos` avisa al equipo de inmediato ([SOS Inteligente](/docs/sos-inteligente)).",
			},
			{
				type: "p",
				text: "Cómo tratamos lo que escribes en un ticket está en la [Política de privacidad](/privacidad).",
			},
		],
	},
];
