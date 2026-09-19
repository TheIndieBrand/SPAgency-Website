import type { DocPage } from "./types";

export const moderation: DocPage[] = [
	{
		slug: "automoderacion",
		title: "Automoderación",
		summary: "Filtros de conducta en el chat y qué pasa cuando alguien acumula infracciones.",
		icon: "bi-funnel",
		blocks: [
			{
				type: "p",
				text: "La automoderación vigila la **conducta en el chat**, mensaje a mensaje: spam, mayúsculas, emojis y textos larguísimos. Cada infracción suma a un contador por persona, y cuando ese contador cruza ciertos límites, se le silencia o se le expulsa.",
			},
			{ type: "h", text: "Los filtros" },
			{
				type: "table",
				head: ["Filtro", "Qué detecta", "Por defecto"],
				rows: [
					["**Anti-flood de mensajes**", "5 mensajes en 5 segundos de la misma persona.", "Activado"],
					["**Ghost-pings**", "Mencionar a alguien y borrar el mensaje en menos de un minuto.", "Desactivado"],
					["**Mayúsculas**", "Un porcentaje alto de letras en mayúscula (solo en mensajes de al menos 10 caracteres).", "Desactivado, umbral 70 %"],
					["**Exceso de emojis**", "Demasiados emojis (personalizados o normales) en un mensaje.", "Desactivado, umbral 8"],
					["**Mensajes largos**", "Demasiadas palabras en un solo mensaje.", "Desactivado, umbral 150"],
				],
			},
			{
				type: "p",
				text: "Los umbrales de mayúsculas, emojis y palabras se ajustan en **Automoderación** en el dashboard. El anti-flood tiene límites fijos.",
			},
			{ type: "h", text: "Qué ve la persona en cada caso" },
			{
				type: "table",
				head: ["Filtro", "¿Borra el mensaje?", "Acción inmediata", "¿Aviso en el canal?"],
				rows: [
					["Anti-flood", "No", "Silencio de 15 segundos", "No"],
					["Ghost-ping", "No aplica (ya lo borró la persona)", "Ninguna", "Sí, público, mencionando a quién si se sabe"],
					["Mayúsculas, emojis, mensajes largos", "Sí", "Ninguna", "Sí, breve; se borra a los 8 segundos"],
				],
			},
			{
				type: "p",
				text: "El anti-flood prioriza parar el spam ya, sin ruido. Los demás filtros sí explican qué ha pasado, porque no hay urgencia equivalente.",
			},
			{ type: "h", text: "Flood de webhooks" },
			{
				type: "p",
				text: "Si un webhook envía 4 mensajes en 10 segundos, SP Agency **elimina el webhook**. No sanciona a nadie: hoy el caso más habitual es un token de webhook filtrado y usado por un tercero, así que el creador del webhook suele ser la víctima, no el atacante. Se activa con **Anti-flood de webhooks** (desactivado por defecto).",
			},
			{ type: "h", text: "El AutoMod de Discord" },
			{
				type: "p",
				text: "Filtrar **palabras prohibidas** y **menciones masivas** ya lo hace muy bien el AutoMod nativo de Discord, así que SP Agency no lo duplica: lo configuras en Discord, en **Ajustes del servidor → AutoMod**.",
			},
			{
				type: "p",
				text: "Lo que sí hace es **enterarse de cuándo actúa** el AutoMod de Discord y sumar esa infracción al mismo contador. Sin eso, alguien podría insultar todo el día sin acercarse nunca a una expulsión de SP Agency.",
			},
			{ type: "h", text: "La escalada de sanciones" },
			{
				type: "p",
				text: "Cada infracción (de cualquiera de los filtros o del AutoMod de Discord) añade un **aviso** a la persona, firmado por “SP Agency” y visible con `/warns` como cualquier otro aviso. El número de infracciones es simplemente el número de esos avisos.",
			},
			{
				type: "table",
				head: ["Ajuste", "Por defecto", "Qué ocurre"],
				rows: [
					["Silenciar (timeout) a partir de", "3 infracciones", "La persona queda silenciada."],
					["Duración del silencio", "10 minutos", "Cuánto dura ese silencio."],
					["Acción final", "No hacer nada", "Qué hacer si sigue infringiendo: **Expulsar** o **Banear**."],
					["Acción final a partir de", "6 infracciones", "Cuándo se aplica la acción final."],
				],
			},
			{
				type: "p",
				text: "Con la configuración por defecto: las infracciones 1 y 2 solo suman avisos; la 3.ª silencia 10 minutos; y si eliges una acción final, la 6.ª la aplica. Cada sanción se aplica **una sola vez**, justo al llegar al número, y no se repite con cada mensaje posterior.",
			},
			{ type: "h", text: "Razones predefinidas" },
			{
				type: "p",
				text: "En **Automoderación → Razones predefinidas** puedes definir una lista de razones rápidas. Si defines alguna, los comandos de moderación **solo aceptan esas razones**, lo que mantiene el historial ordenado y coherente entre todo el staff.",
			},
		],
	},
	{
		slug: "comandos",
		title: "Comandos",
		summary: "Todos los comandos de SP Agency, con el permiso que necesitas para usarlos.",
		icon: "bi-terminal",
		blocks: [
			{
				type: "p",
				text: "SP Agency usa comandos de barra (`/`). Escribe `/comandos` para verlos todos desde Discord, o `/comandos comando:ban` para ver cómo se usa uno concreto. Las opciones de cada comando están en el idioma de tu servidor.",
			},
			{
				type: "callout",
				tone: "info",
				title: "Reglas comunes",
				text: "Necesitas el permiso indicado en cada comando. No puedes moderar a alguien con un rol igual o superior al tuyo, ni a ti mismo, ni al bot. Al moderar a un miembro, este recibe un mensaje privado con la razón. Los comandos destructivos piden confirmación antes de ejecutarse.",
			},
			{ type: "h", text: "Moderación" },
			{
				type: "table",
				head: ["Comando", "Qué hace", "Permiso"],
				rows: [
					["`/ban miembro razon`", "Banea a un miembro.", "Banear miembros"],
					["`/tempban miembro minutos razon`", "Banea durante un tiempo (mínimo 2 minutos) y desbanea solo al terminar.", "Banear miembros"],
					["`/hackban id razon`", "Banea por ID a alguien que no está en el servidor.", "Banear miembros"],
					["`/unban id`", "Desbanea a un usuario.", "Banear miembros"],
					["`/baninfo usuario`", "Muestra el detalle de un baneo.", "Banear miembros"],
					["`/kick miembro razon`", "Expulsa a un miembro.", "Expulsar miembros"],
					["`/timeout miembro minutos razon`", "Aísla (silencia) a un miembro entre 10 minutos y 28 días.", "Aislar miembros"],
					["`/untimeout miembro`", "Quita el aislamiento.", "Aislar miembros"],
					["`/warn miembro razon`", "Añade un aviso.", "Gestionar mensajes"],
					["`/warns miembro`", "Lista los avisos de un miembro.", "Gestionar mensajes"],
					["`/unwarn miembro id`", "Elimina un aviso concreto, o todos con `todos:true`.", "Gestionar mensajes"],
					["`/clear cantidad`", "Borra de 1 a 1000 mensajes del canal.", "Gestionar mensajes"],
					["`/lock` y `/unlock`", "Bloquea o desbloquea el canal para un rol (por defecto, @everyone).", "Gestionar canales"],
					["`/nuke`", "Borra y recrea el canal, eliminando todos sus mensajes. Pide confirmación.", "Gestionar canales"],
				],
			},
			{ type: "h", text: "Protección y blacklist" },
			{
				type: "table",
				head: ["Comando", "Qué hace", "Permiso"],
				rows: [
					["`/detect`", "Escanea tus miembros contra la lista de [miembros maliciosos](/docs/miembros-maliciosos).", "Banear miembros"],
					["`/forceban razon`", "Banea a todos los de esa lista, sean miembros o no. Pide confirmación.", "Administrador"],
					["`/sos`", "Avisa al equipo de SP Agency. Ver [SOS Inteligente](/docs/sos-inteligente).", "Administrador"],
				],
			},
			{ type: "h", text: "Gestión del servidor" },
			{
				type: "table",
				head: ["Comando", "Qué hace", "Permiso"],
				rows: [
					["`/channel create nombre`", "Crea un canal de texto.", "Gestionar canales"],
					["`/channel delete canal`", "Elimina un canal.", "Gestionar canales"],
					["`/guild set-name nombre`", "Cambia el nombre del servidor.", "Gestionar servidor"],
					["`/guild set-icon url`", "Cambia el icono del servidor.", "Gestionar servidor"],
					["`/guild create-invite`", "Crea una invitación en un canal de texto al azar.", "Crear invitación"],
					["`/guild info`", "Muestra información del servidor.", "Ninguno"],
					["`/member set-nickname miembro apodo`", "Cambia el apodo de un miembro.", "Gestionar apodos"],
					["`/member add-role` y `/member remove-role`", "Añade o quita un rol a un miembro.", "Gestionar roles"],
					["`/member info miembro`", "Muestra información de un miembro.", "Ninguno"],
				],
			},
			{ type: "h", text: "Recuperación" },
			{
				type: "table",
				head: ["Comando", "Qué hace", "Quién"],
				rows: [
					["`/unnuke channels|roles|emojis|bans`", "Limpia el daño de un raid.", "Propietario del servidor"],
					["`/backup create|info|load|delete`", "Guarda y restaura una copia del servidor.", "Propietario del servidor"],
				],
			},
			{
				type: "p",
				text: "Se explican en [Recuperación](/docs/recuperacion).",
			},
			{ type: "h", text: "Otros" },
			{
				type: "table",
				head: ["Comando", "Qué hace"],
				rows: [
					["`/comandos`", "Lista todos los comandos, o explica uno concreto."],
					["`/ping`", "Muestra la latencia del bot."],
					["`/me`, `/reporte`, `/apelar`", "Consulta, reporte y apelación en la lista de [miembros maliciosos](/docs/miembros-maliciosos)."],
				],
			},
		],
	},
];
