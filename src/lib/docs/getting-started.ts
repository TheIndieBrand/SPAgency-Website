import type { DocPage } from "./types";

export const gettingStarted: DocPage[] = [
	{
		slug: "primeros-pasos",
		title: "Primeros pasos",
		summary: "De invitar al bot a tener tu servidor protegido en unos minutos.",
		icon: "bi-rocket-takeoff",
		blocks: [
			{
				type: "p",
				text: "SP Agency es un bot de seguridad para Discord. Vigila tu servidor las 24 horas, frena raids sin que tengas que estar delante y te da herramientas para moderar y recuperarte si algo sale mal. Esta guía te lleva de cero a protegido.",
			},
			{ type: "h", text: "1. Invita a SP Agency" },
			{
				type: "p",
				text: "Pulsa **Añadir a Discord**, elige tu servidor y acepta los permisos. Para invitar un bot necesitas el permiso **Gestionar servidor** en ese servidor.",
			},
			{ type: "h", text: "2. Sube su rol a lo más alto" },
			{
				type: "p",
				text: "Discord solo deja que un bot actúe sobre roles y miembros que estén por debajo de su propio rol. En **Ajustes del servidor → Roles**, arrastra el rol de SP Agency hasta la primera posición de la lista.",
			},
			{
				type: "callout",
				tone: "warning",
				title: "No te saltes este paso",
				text: "Si hay otro rol por encima del de SP Agency, el Anti-Raid se desactiva solo, porque no podría banear a quien tenga ese rol. Más detalles en [Permisos y jerarquía](/docs/permisos).",
			},
			{ type: "h", text: "3. Abre el dashboard" },
			{
				type: "p",
				text: "Entra en el **Dashboard**, inicia sesión con Discord y elige tu servidor. Desde ahí configuras todo sin escribir comandos:",
			},
			{
				type: "table",
				head: ["Sección", "Para qué sirve"],
				rows: [
					["General", "Resumen del estado de tu servidor."],
					["Registros de actividad", "Historial de eventos de seguridad y acciones de moderación."],
					["Anti-Raid & Bots", "Anti-Raid, Modo Pánico, Anti-Bots, selfbots, miembros maliciosos, verificación y SOS."],
					["Automoderación", "Filtros de spam, mayúsculas, emojis y mensajes largos, y qué pasa al acumular infracciones."],
					["Alertas y Canales", "Canal de logs y lista blanca."],
					["Ajustes", "Idioma, copias de seguridad y zona de peligro."],
				],
			},
			{ type: "h", text: "4. Elige un canal de logs" },
			{
				type: "p",
				text: "En **Alertas y Canales → Canal de logs** indica dónde quieres ver en directo lo que hace el bot. Todo se guarda igualmente aunque no elijas ninguno, pero sin canal no lo verás en Discord. Ver [Registros](/docs/registros).",
			},
			{ type: "h", text: "5. Ajusta la protección" },
			{
				type: "p",
				text: "SP Agency viene con una configuración prudente. Esto es lo que está activo desde el primer minuto:",
			},
			{
				type: "table",
				head: ["Protección", "Por defecto"],
				rows: [
					["[Anti-Raid](/docs/anti-raid)", "Activado"],
					["Anti-flood de mensajes ([Automoderación](/docs/automoderacion))", "Activado"],
					["[Miembros maliciosos](/docs/miembros-maliciosos)", "Marcar (avisa y cambia el apodo)"],
					["[Anti-Bots](/docs/anti-bots), [selfbots](/docs/selfbots), [verificación](/docs/verificacion), [SOS](/docs/sos-inteligente)", "Desactivados"],
					["[Modo Pánico](/docs/modo-panico)", "Desactivado (se activa a mano)"],
				],
			},
			{
				type: "callout",
				tone: "tip",
				title: "Una configuración razonable",
				text: "Deja el Anti-Raid activo, pon los selfbots en **Expulsar** y activa Anti-Bots en **Solo no verificados** si no quieres que se cuele ningún bot desconocido. El resto, según lo que necesite tu comunidad.",
			},
			{
				type: "p",
				text: "Para ver todos los comandos disponibles, escribe `/comandos` en cualquier canal. También tienes la lista completa en [Comandos](/docs/comandos).",
			},
		],
	},
	{
		slug: "permisos",
		title: "Permisos y jerarquía",
		summary: "Qué necesita el bot para poder protegerte, y qué pasa si le falta algo.",
		icon: "bi-key",
		blocks: [
			{
				type: "p",
				text: "Para frenar un raid, SP Agency tiene que poder banear al atacante y enterarse de lo que ocurre. Eso depende de tres cosas de su configuración en tu servidor.",
			},
			{ type: "h", text: "Lo que necesita el Anti-Raid" },
			{
				type: "table",
				head: ["Requisito", "Por qué"],
				rows: [
					["Permiso **Banear miembros**", "Es la forma de expulsar al atacante."],
					["Permiso **Ver registro de auditoría**", "Sin él, Discord no le avisa de lo que se hace en el servidor y no puede detectar nada."],
					["Su rol en **la posición más alta** de la lista", "Un bot solo puede actuar sobre roles por debajo del suyo. Si hay otro rol por encima, un atacante con ese rol sería intocable."],
				],
			},
			{ type: "h", text: "Qué pasa si falta alguno" },
			{
				type: "p",
				text: "El Anti-Raid **se desactiva solo** y lo deja registrado, en lugar de quedarse encendido sin poder hacer nada. Así nunca tienes una falsa sensación de seguridad. El mensaje del log te dice qué corregir.",
			},
			{
				type: "list",
				items: [
					"El bot revisa estos requisitos cada vez que cambia un rol, sus permisos o su propio rol, y cada vez que se reconecta a Discord.",
					"Cuando lo hayas corregido, **vuelve a activar el Anti-Raid** desde el dashboard: no se reactiva por sí solo.",
				],
			},
			{ type: "h", text: "Permisos para cada comando" },
			{
				type: "p",
				text: "Cada comando pide al usuario el permiso de Discord que le corresponde: `/ban` exige **Banear miembros**, `/clear` exige **Gestionar mensajes**, y así con todos (los tienes en [Comandos](/docs/comandos)). Si al bot le falta un permiso para hacer lo que le pides, te lo dice en el momento.",
			},
			{
				type: "callout",
				tone: "info",
				title: "Comandos solo para el propietario",
				text: "`/unnuke` y `/backup` los puede usar únicamente el **propietario del servidor**, además de exigir permiso de Administrador. Son los más destructivos y por eso están más restringidos.",
			},
			{
				type: "callout",
				tone: "info",
				title: "Moderar a alguien por encima de ti",
				text: "Igual que con el bot, no puedes moderar (banear, expulsar, silenciar…) a alguien con un rol igual o superior al tuyo, ni a ti mismo.",
			},
		],
	},
];
