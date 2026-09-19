import type { DocPage } from "./types";

export const protection: DocPage[] = [
	{
		slug: "anti-raid",
		title: "Anti-Raid",
		summary: "Detecta una ráfaga de acciones destructivas y banea al causante al instante.",
		icon: "bi-shield-check",
		blocks: [
			{
				type: "p",
				text: "Un raid suele empezar con alguien (o un bot con permisos) creando decenas de canales y roles, o baneando miembros a toda velocidad. El Anti-Raid vigila esas acciones, y cuando ve que se acumulan, **banea a quien las está causando sin esperar a que tú te enteres**.",
			},
			{ type: "h", text: "Cómo funciona" },
			{
				type: "p",
				text: "Se vigilan estas acciones: crear o eliminar canales, crear o eliminar roles, y banear o desbanear miembros. Si se acumulan **3 en 10 segundos**, salta la alarma. Todas cuentan en el mismo contador, así que un raid que mezcla canales y roles se detecta como una sola ráfaga.",
			},
			{
				type: "list",
				items: [
					"**Crear un canal con un nombre que ya existe cuenta doble**, porque es un patrón típico de raid. Solo hace que la alarma salte antes; no cambia el límite para el resto.",
					"**Añadir un bot no cuenta** para la ráfaga: es algo habitual al configurar un servidor.",
					"Los límites (3 acciones, 10 segundos) son fijos. Lo que decides tú es si el Anti-Raid está activo y a quién eximes.",
				],
			},
			{ type: "h", text: "Qué hace cuando salta" },
			{
				type: "list",
				items: [
					"**Banea al causante.**",
					"Si el causante es un **bot**, banea también a la persona que lo añadió. Ver [Quien añade un bot raider](#quien-anade-un-bot-raider).",
					"Guarda un evento de **Raid detectado** en los [registros](/docs/registros).",
					"Si tienes activado el [SOS inteligente](/docs/sos-inteligente), avisa al equipo de SP Agency.",
				],
			},
			{ type: "h", text: "Quien añade un bot raider" },
			{
				type: "p",
				text: "Añadir un bot mediante OAuth2 es una autorización, y quien la da es tan responsable del raid como el bot. Por eso, cuando un bot se banea por raider (por el Anti-Raid, el Modo Pánico o por estar en la lista de UBFB), **se banea también a quien lo añadió**. SP Agency guarda quién añadió cada bot en el momento en que ocurre, así que funciona aunque el bot llevara meses en el servidor.",
			},
			{
				type: "callout",
				tone: "info",
				title: "Sin excepciones para el staff",
				text: "Esta regla no respeta la lista blanca: añadir un bot que resulta raider es responsabilidad de quien lo añade, sea staff o no. Si el bot se añadió antes de tener SP Agency o con el bot caído, solo se banea al bot.",
			},
			{ type: "h", text: "Cuándo no actúa" },
			{
				type: "list",
				items: [
					"Si las acciones las hace **el propio SP Agency** (por ejemplo, al restaurar una copia de seguridad).",
					"Si quien las hace está en la **lista blanca** (ver más abajo).",
					"Si el Anti-Raid está **desactivado**, o se ha desactivado solo por falta de permisos ([Permisos y jerarquía](/docs/permisos)).",
				],
			},
			{ type: "h", text: "Lista blanca" },
			{
				type: "p",
				text: "En **Alertas y Canales → Lista blanca** puedes añadir usuarios o bots (por su ID) que quedan exentos del Anti-Raid. Es útil para el bot de tickets que crea un canal por cada usuario o para un administrador que reorganiza el servidor.",
			},
			{
				type: "callout",
				tone: "warning",
				title: "Dónde no vale la lista blanca",
				text: "El [Modo Pánico](/docs/modo-panico) no la respeta a propósito, y tampoco la regla de baneo a quien añade un bot raider. Añade a la lista solo a quien de verdad necesite hacer estas acciones.",
			},
			{ type: "h", text: "Después de un raid" },
			{
				type: "p",
				text: "Ninguna detección es perfecta, así que SP Agency incluye herramientas para deshacer el daño: consulta [Recuperación](/docs/recuperacion).",
			},
			{
				type: "table",
				head: ["Ajuste", "Por defecto"],
				rows: [["Activar protección Anti-Raid", "Activado"]],
			},
		],
	},
	{
		slug: "modo-panico",
		title: "Modo Pánico (Raidmode)",
		summary: "Bloqueo total para cuando ya sabes que estás bajo ataque.",
		icon: "bi-exclamation-octagon",
		blocks: [
			{
				type: "p",
				text: "El Anti-Raid trabaja siempre en segundo plano y es prudente para evitar falsos positivos. El Modo Pánico es lo contrario: lo activas **tú**, cuando ya sabes que hay un ataque, y a partir de ese momento **cualquier acción sospechosa se castiga sin margen de error**.",
			},
			{
				type: "callout",
				tone: "warning",
				title: "Úsalo solo durante un ataque activo",
				text: "No hay umbral ni beneficio de la duda: una sola acción sospechosa basta. Mientras está activo, reemplaza al Anti-Raid, al Anti-Bots y a la detección de miembros maliciosos para esas acciones, en lugar de funcionar a la vez.",
			},
			{ type: "h", text: "Qué pasa mientras está activo" },
			{
				type: "table",
				head: ["Qué ocurre", "Consecuencia"],
				rows: [
					["Alguien se une (persona o bot)", "**Baneo temporal**, con la duración que hayas configurado. Si es un bot, también se banea a quien lo añadió."],
					["Alguien crea o borra un canal o un rol, o banea o desbanea", "**Baneo permanente** al que lo hizo."],
					["Alguien añade un bot", "**Baneo permanente** a quien lo autorizó (el bot recibe su baneo temporal al unirse)."],
				],
			},
			{ type: "h", text: "Excepciones: solo dos" },
			{
				type: "list",
				items: [
					"**El propietario del servidor**, al que Discord ya no deja banear.",
					"**El propio SP Agency**, para que restaurar una copia de seguridad no lo autobanee.",
				],
			},
			{
				type: "p",
				text: "**No hay lista blanca.** Una puerta abierta con ingeniería social o un token robado también se cierra durante el bloqueo, y eso incluye al staff.",
			},
			{ type: "h", text: "Activarlo y desactivarlo" },
			{
				type: "p",
				text: "En **Anti-Raid & Bots → Modo Pánico (Raidmode)** hay un interruptor. Cuando está activo verás la etiqueta roja **Modo Pánico Activo** en la cabecera del dashboard.",
			},
			{
				type: "p",
				text: "Se **desactiva solo** pasado el tiempo que elijas en **Auto-desactivar tras** (minutos, horas, días o semanas). Ese mismo tiempo es la duración del baneo temporal para quien se une mientras está activo. Al terminar queda un aviso de que expiró en los [registros](/docs/registros).",
			},
			{
				type: "list",
				items: [
					"No te envía un mensaje privado al activarse: ya sabes que hay un problema, sería ruido.",
					"Todo lo que hace queda registrado. Si hay muchos eventos de golpe, se agrupan para no saturar el canal.",
				],
			},
			{
				type: "table",
				head: ["Ajuste", "Por defecto"],
				rows: [
					["Activar Modo Pánico", "Desactivado"],
					["Auto-desactivar tras", "1 día"],
				],
			},
		],
	},
	{
		slug: "anti-bots",
		title: "Anti-Bots",
		summary: "Expulsa bots al unirse, antes de que puedan hacer nada.",
		icon: "bi-robot",
		blocks: [
			{
				type: "p",
				text: "Un bot actúa en cuanto entra, con todos los permisos que le hayan dado y sin esperar a que nadie lo revise. Por eso el Anti-Bots **los bloquea en el momento de unirse**, en lugar de detectarlos y actuar después.",
			},
			{ type: "h", text: "Modos" },
			{
				type: "table",
				head: ["Modo", "Qué hace"],
				rows: [
					["**Todos los bots**", "Expulsa cualquier bot que intente unirse."],
					["**Solo no verificados por Discord**", "Expulsa únicamente a los bots que Discord no ha verificado. Deja pasar a los verificados."],
				],
			},
			{
				type: "p",
				text: "La verificación de Discord es la señal por defecto: es una revisión externa que un bot casero o malicioso no puede falsificar. Si activas el Anti-Bots sin más, funciona en el modo **Todos los bots**.",
			},
			{
				type: "callout",
				tone: "tip",
				title: "Y si quiero añadir un bot mío",
				text: "Con el modo **Todos los bots**, cualquier bot se expulsa, también los que tú quieras añadir. Cambia al modo de solo no verificados o desactiva el Anti-Bots un momento mientras lo añades.",
			},
			{ type: "h", text: "Detalles" },
			{
				type: "list",
				items: [
					"La acción es una **expulsión** (no un baneo). Cada expulsión queda en los [registros](/docs/registros).",
					"Si el bot está además en la lista de [miembros maliciosos](/docs/miembros-maliciosos), se **banea** en lugar de expulsarse, y también a quien lo añadió.",
				],
			},
			{
				type: "table",
				head: ["Ajuste", "Por defecto"],
				rows: [
					["Activar Anti-Bots", "Desactivado"],
					["Alcance", "Todos los bots"],
				],
			},
		],
	},
	{
		slug: "selfbots",
		title: "Selfbots y cuentas falsas",
		summary: "Puntúa cada cuenta que entra y actúa solo cuando varias señales coinciden.",
		icon: "bi-person-badge",
		blocks: [
			{
				type: "p",
				text: "Ninguna característica de una cuenta prueba por sí sola que sea falsa: una cuenta recién creada puede ser alguien real. Por eso SP Agency **no actúa por una sola señal**. Cada señal suma puntos, y solo si la suma llega al umbral se toma una medida. Así hay muchos menos falsos positivos.",
			},
			{ type: "h", text: "Las señales" },
			{
				type: "table",
				head: ["Señal", "Puntos"],
				rows: [
					["Cuenta **más nueva** que la antigüedad mínima que hayas fijado", "2"],
					["**Entradas simultáneas**: 3 o más cuentas uniéndose en 10 segundos", "2"],
					["Sin avatar (avatar por defecto)", "1"],
					["Nombre con el patrón típico de los generadores masivos", "1"],
				],
			},
			{
				type: "p",
				text: "El umbral son **3 puntos**. Por ejemplo, una cuenta nueva sin avatar (2 + 1) ya cumple; un nombre sospechoso él solo (1) nunca cumplirá. Todas las señales se calculan con datos que Discord ya envía al entrar, así que no ralentizan nada.",
			},
			{ type: "h", text: "Configuración" },
			{
				type: "table",
				head: ["Ajuste", "Por defecto", "Qué hace"],
				rows: [
					["Acción al detectar", "No hacer nada", "**No hacer nada** solo deja el evento en el registro. **Expulsar** o **Banear** además actúan."],
					["Antigüedad mínima de cuenta", "30 días", "Las cuentas más nuevas suman 2 puntos. Se puede indicar en horas, días o semanas."],
				],
			},
			{
				type: "callout",
				tone: "tip",
				title: "Mejor expulsar que banear",
				text: "Esto es una heurística, no una confirmación. Una expulsión se puede revertir (la persona vuelve a entrar con una invitación); un baneo por una puntuación equivocada es difícil de justificar. Banear queda disponible para quien quiera la máxima agresividad.",
			},
			{ type: "h", text: "Detalles" },
			{
				type: "list",
				items: [
					"No se aplica a bots: de esos se encarga el [Anti-Bots](/docs/anti-bots).",
					"Es la última comprobación al unirse. Si alguien ya fue expulsado por un motivo más sólido (Modo Pánico, miembro malicioso, bot no permitido), no se le puntúa.",
					"Cuando se detecta, el registro dice **por qué**: qué señales sumaron y la puntuación. Sirve para ajustar la antigüedad mínima con datos reales.",
					"Si la puntuación no llega al umbral, no queda registro.",
				],
			},
		],
	},
	{
		slug: "miembros-maliciosos",
		title: "Miembros maliciosos (UBFB)",
		summary: "Comprueba cada persona que entra contra la lista global de usuarios maliciosos.",
		icon: "bi-person-x",
		blocks: [
			{
				type: "p",
				text: "**UBFB** mantiene una lista negra global de usuarios señalados como maliciosos (raiders, estafadores…). Cada vez que alguien entra en tu servidor, SP Agency comprueba si está en esa lista. La comprobación es instantánea y no ralentiza las entradas.",
			},
			{ type: "h", text: "Qué hacer cuando alguien de la lista entra" },
			{
				type: "table",
				head: ["Acción", "Qué ocurre"],
				rows: [
					["**No hacer nada**", "Solo queda registrado que entró."],
					["**Marcar** (por defecto)", "Te llega un mensaje privado como propietario, y el apodo de la persona cambia al motivo de su entrada en la lista, para que el staff lo vea a simple vista."],
					["**Banear**", "Mensaje privado al propietario y baneo directo. Es un baneo y no una expulsión, para que no pueda volver a intentarlo al instante."],
				],
			},
			{
				type: "p",
				text: "Que entre alguien de la lista **siempre queda registrado**, aunque elijas No hacer nada. Si SP Agency no puede cambiar un apodo (por permisos o jerarquía), lo omite en silencio; el registro y el aviso siguen adelante.",
			},
			{
				type: "callout",
				tone: "warning",
				title: "Los bots maliciosos siempre se banean",
				text: "Sin importar lo que elijas arriba. No tiene sentido marcar y dejar entrar a un bot que está en la lista global. Además, se banea también a quien lo añadió ([Anti-Raid](/docs/anti-raid#quien-anade-un-bot-raider)).",
			},
			{ type: "h", text: "Comandos relacionados" },
			{
				type: "table",
				head: ["Comando", "Qué hace"],
				rows: [
					["`/detect`", "Escanea los miembros actuales de tu servidor contra la lista y te dice cuántos hay."],
					["`/forceban`", "Banea de golpe a todos los de la lista, sean miembros o no. Puedes filtrar por motivo. Pide confirmación."],
					["`/me`", "Comprueba si tú (u otra persona) estás en la lista."],
					["`/reporte`", "Reporta a un usuario para que UBFB lo revise (con motivo y hasta tres pruebas en imagen)."],
					["`/apelar`", "Te dice dónde apelar si estás en la lista y crees que es un error."],
				],
			},
			{
				type: "table",
				head: ["Ajuste", "Por defecto"],
				rows: [["Acción al detectar", "Marcar"]],
			},
		],
	},
	{
		slug: "verificacion",
		title: "Verificación",
		summary: "Los nuevos miembros confirman que son personas antes de recibir un rol.",
		icon: "bi-patch-check",
		blocks: [
			{
				type: "p",
				text: "La verificación es **solo web**: inicio de sesión con Discord y un captcha. Sustituye a los métodos clásicos de código en el chat o botón, que un selfbot resuelve con unas pocas líneas de código; un inicio de sesión real y un captcha no.",
			},
			{ type: "h", text: "Cómo lo vive un miembro nuevo" },
			{
				type: "list",
				ordered: true,
				items: [
					"Entra en tu servidor y recibe un **mensaje privado** de SP Agency con un enlace personal.",
					"Abre el enlace, inicia sesión con Discord y resuelve el captcha.",
					"SP Agency le concede al instante el rol que hayas configurado.",
				],
			},
			{
				type: "p",
				text: "El enlace **caduca a los 15 minutos** y solo sirve para esa persona en ese servidor.",
			},
			{ type: "h", text: "Configurarlo" },
			{
				type: "table",
				head: ["Ajuste", "Por defecto", "Qué hace"],
				rows: [
					["Requerir verificación", "Desactivado", "Activa el envío del enlace a cada miembro nuevo."],
					["Rol al verificar", "Ninguno", "El rol que se concede al completar la verificación."],
				],
			},
			{
				type: "callout",
				tone: "tip",
				title: "El rol no oculta nada por sí solo",
				text: "SP Agency concede el rol, pero eres tú quien decide qué puede ver. Configura los permisos de tus canales para que solo quienes tengan el rol de verificado accedan a ellos (y deja un canal de bienvenida visible para todos).",
			},
			{ type: "h", text: "Detalles" },
			{
				type: "list",
				items: [
					"Si cambias el **rol al verificar** después de que alguien recibiera su enlace, se le concede el nuevo, no el que había cuando se envió.",
					"El rol de SP Agency debe estar **por encima** del rol de verificado, o Discord no le dejará concederlo ([Permisos y jerarquía](/docs/permisos)).",
					"La verificación se ejecuta la última. Nunca expulsa ni banea, solo envía el enlace; a quien ya haya sido expulsado por otra protección no se le envía.",
				],
			},
		],
	},
	{
		slug: "sos-inteligente",
		title: "SOS Inteligente",
		summary: "Avisa al equipo de SP Agency cuando tu servidor sufre un ataque serio.",
		icon: "bi-broadcast",
		blocks: [
			{
				type: "p",
				text: "Si un raid te desborda y no hay nadie conectado, puede que nadie se entere hasta que sea tarde. El SOS avisa al **equipo de SP Agency** con una invitación reciente a tu servidor, para que puedan echarte una mano.",
			},
			{ type: "h", text: "Dos formas de activarlo" },
			{
				type: "table",
				head: ["Forma", "Cómo funciona"],
				rows: [
					["**Automático**", "Cuando el [Anti-Raid](/docs/anti-raid) banea a un atacante y tienes el SOS Inteligente activado, se envía un aviso con el motivo. Hay un margen de 2 minutos entre avisos para no repetirlos."],
					["**Manual: `/sos`**", "Un administrador lo ejecuta a propósito. No depende del ajuste ni tiene espera."],
				],
			},
			{
				type: "list",
				items: [
					"El aviso incluye el nombre y el ID de tu servidor y una **invitación nueva** para entrar a él.",
					"El automático solo se dispara por el Anti-Raid. El [Modo Pánico](/docs/modo-panico) no lo usa (ya sabes que hay un problema) ni las expulsiones rutinarias de bots o cuentas falsas.",
					"El mensaje va en el idioma configurado en tu servidor.",
					"`/sos` necesita permiso de **Administrador** para quien lo ejecuta y para el bot.",
				],
			},
			{
				type: "table",
				head: ["Ajuste", "Por defecto"],
				rows: [["Activar SOS Inteligente", "Desactivado"]],
			},
		],
	},
];
