import { getSql, isoUtc } from "./client";

// a guild's activity log: merges the events the bot detects
// (`server_event_logs`) with the actions requested of it (`bot_action_logs`).
// the database stores the type and the data, not the text — this is where
// each type is turned into a sentence (the bot's own templates live on its
// side, in its locale files).

export type Tone = "danger" | "warning" | "info" | "success";

export interface ActivityRow {
	source: "event" | "action";
	id: number;
	type: string;
	targetId: string | null;
	executorId: string | null;
	reason: string | null;
	data: Record<string, unknown> | null;
	createdAt: string; // ISO UTC
}

export interface Activity {
	id: string;
	type: string;
	label: string;
	icon: string;
	tone: Tone;
	at: string; // ISO UTC
}

/**
 * reads a guild's activity log, merging the bot's detected events and its
 * requested actions into one timeline.
 *
 * the query here mirrors what already existed — this class only wraps it, it
 * never changes a column, a table or what the query returns.
 */
export class ActivityRepository {
	/**
	 * lists the most recent activity rows for a guild.
	 * @param guildId - the discord guild id.
	 * @param limit - the maximum number of rows to return.
	 * @returns the rows, or null if the query failed.
	 */
	async listActivity(guildId: string, limit = 200): Promise<ActivityRow[] | null> {
		try {
			const sql = getSql();
			return await sql<ActivityRow[]>`
				select source, id, type, target_id, executor_id, reason, data, ${sql.unsafe(isoUtc("created_at"))} as created_at
				from (
					select 'event' as source, id, type, target_id, null::text as executor_id, null::text as reason, data, created_at
					from server_event_logs where guild_id = ${guildId}
					union all
					select 'action', id, type, target_id, executor_id, reason, data, created_at
					from bot_action_logs where guild_id = ${guildId}
				) t
				order by t.created_at desc, t.id desc
				limit ${limit}
			`;
		} catch (error) {
			console.error("[db] no se pudo leer la actividad:", error instanceof Error ? error.message : error);
			return null;
		}
	}
}

export const activityRepository = new ActivityRepository();

// ── translation to text ─────────────────────────────────────────────────────

interface Presentation {
	label: string;
	icon: string;
	tone: Tone;
}

const DETECTORS: Record<string, string> = {
	flood: "flood de mensajes",
	ghostping: "ghost-ping",
	capsLock: "mayúsculas",
	manyEmojis: "exceso de emojis",
	manyWords: "mensaje demasiado largo",
	nativeAutomod: "AutoMod de Discord",
};
const SANCTIONS: Record<string, string> = { warn: "aviso", mute: "silencio", kick: "expulsión", ban: "baneo" };
const ACTIONS: Record<string, string> = { none: "sin acción", mark: "marcado", kick: "expulsado", ban: "baneado" };

const str = (value: unknown): string => (typeof value === "string" ? value : "");

// discord ids mean nothing to a reader: shown as `@id` until there are names
// (discord has those, the database doesn't).
const user = (id: string | null) => (id ? `@${id}` : "alguien");
const by = (row: ActivityRow) => (!row.executorId ? "" : row.executorId === "system" ? " por SP Agency" : ` por ${user(row.executorId)}`);
const why = (row: ActivityRow) => (row.reason ? ` — ${row.reason}` : "");

const EVENTS: Record<string, (r: ActivityRow) => Presentation> = {
	channelCreate: (r) => ({ label: `Canal creado (${r.targetId ?? "?"})`, icon: "bi-plus-square", tone: "success" }),
	channelDelete: (r) => ({ label: `Canal eliminado (${r.targetId ?? "?"})`, icon: "bi-dash-square", tone: "warning" }),
	channelUpdate: (r) => ({ label: `Canal editado (${r.targetId ?? "?"})`, icon: "bi-pencil-square", tone: "info" }),
	roleCreate: (r) => ({ label: `Rol creado (${r.targetId ?? "?"})`, icon: "bi-plus-circle", tone: "success" }),
	roleDelete: (r) => ({ label: `Rol eliminado (${r.targetId ?? "?"})`, icon: "bi-dash-circle", tone: "warning" }),
	webhookCreate: () => ({ label: "Webhook creado", icon: "bi-link-45deg", tone: "info" }),
	ban: (r) => ({ label: `${user(r.targetId)} ha sido baneado`, icon: "bi-hammer", tone: "danger" }),
	unban: (r) => ({ label: `${user(r.targetId)} ha sido desbaneado`, icon: "bi-unlock", tone: "success" }),
	raidDetected: (r) => ({ label: `Raid detectado y frenado — ${user(r.targetId)} baneado`, icon: "bi-shield-fill-exclamation", tone: "danger" }),
	antibotsKick: (r) => ({ label: `Bot ${user(r.targetId)} expulsado: no se permiten bots`, icon: "bi-robot", tone: "warning" }),
	antiraidDisabled: () => ({ label: "El Anti-Raid se desactivó solo: al bot le faltan permisos o su rol no es el más alto", icon: "bi-shield-slash", tone: "danger" }),
	logsDisabled: () => ({ label: "El canal de logs se desactivó tras un fallo de envío", icon: "bi-journal-x", tone: "warning" }),
	maliciousMemberJoin: (r) => ({
		label: `Cuenta maliciosa conocida (${user(r.targetId)}) se ha unido — ${ACTIONS[str(r.data?.action)] ?? "sin acción"}`,
		icon: "bi-person-fill-x",
		tone: "danger",
	}),
	raidmodeJoinBan: (r) => ({ label: `Modo Pánico: ${user(r.targetId)} se unió y fue baneado temporalmente`, icon: "bi-lock", tone: "danger" }),
	raidmodeActionBan: (r) => ({ label: `Modo Pánico: ${user(r.targetId)} hizo un cambio y fue baneado`, icon: "bi-lock", tone: "danger" }),
	raidmodeExpired: () => ({ label: "El Modo Pánico se desactivó al cumplirse su duración", icon: "bi-unlock", tone: "info" }),
	selfbotDetected: (r) => ({
		label: `${user(r.targetId)} parece un selfbot o cuenta falsa (${Number(r.data?.score ?? 0)} puntos) — ${ACTIONS[str(r.data?.action)] ?? "sin acción"}`,
		icon: "bi-person-badge",
		tone: "warning",
	}),
	automodViolation: (r) => ({
		label: `Automod: ${user(r.targetId)} — ${DETECTORS[str(r.data?.detector)] ?? str(r.data?.detector)} (${SANCTIONS[str(r.data?.sanction)] ?? str(r.data?.sanction)})`,
		icon: "bi-funnel",
		tone: "warning",
	}),
	webhookFloodPurge: (r) => ({ label: `Webhook eliminado por flood (${r.targetId ?? "?"})`, icon: "bi-link-45deg", tone: "warning" }),
	raidBotAdderBan: (r) => ({ label: `${user(r.targetId)} añadió un bot raider (${str(r.data?.botId)}) y fue baneado también`, icon: "bi-hammer", tone: "danger" }),
};

const ACTION_TYPES: Record<string, (r: ActivityRow) => Presentation> = {
	ban: (r) => ({ label: `${user(r.targetId)} baneado${by(r)}${why(r)}`, icon: "bi-hammer", tone: "danger" }),
	unban: (r) => ({ label: `${user(r.targetId)} desbaneado${by(r)}`, icon: "bi-unlock", tone: "success" }),
	forceban: (r) => ({ label: `Baneo masivo de la lista de UBFB${by(r)}`, icon: "bi-hammer", tone: "danger" }),
	hackban: (r) => ({ label: `${user(r.targetId)} baneado por ID${by(r)}${why(r)}`, icon: "bi-hammer", tone: "danger" }),
	kick: (r) => ({ label: `${user(r.targetId)} expulsado${by(r)}${why(r)}`, icon: "bi-box-arrow-right", tone: "warning" }),
	timeout: (r) => ({ label: `${user(r.targetId)} silenciado${by(r)}${why(r)}`, icon: "bi-mic-mute", tone: "warning" }),
	untimeout: (r) => ({ label: `Silencio de ${user(r.targetId)} retirado${by(r)}`, icon: "bi-mic", tone: "success" }),
	tempban: (r) => ({ label: `${user(r.targetId)} baneado temporalmente${by(r)}${why(r)}`, icon: "bi-hourglass-split", tone: "danger" }),
	warn: (r) => ({ label: `Aviso a ${user(r.targetId)}${by(r)}${why(r)}`, icon: "bi-exclamation-triangle", tone: "warning" }),
	unwarn: (r) => ({ label: `Aviso de ${user(r.targetId)} eliminado${by(r)}`, icon: "bi-check-circle", tone: "success" }),
	clear: (r) => ({ label: `Mensajes borrados${by(r)}`, icon: "bi-eraser", tone: "info" }),
	lock: (r) => ({ label: `Canal bloqueado${by(r)}`, icon: "bi-lock", tone: "info" }),
	unlock: (r) => ({ label: `Canal desbloqueado${by(r)}`, icon: "bi-unlock", tone: "info" }),
	nuke: (r) => ({ label: `Canal reiniciado (nuke)${by(r)}`, icon: "bi-radioactive", tone: "danger" }),
	backupCreate: (r) => ({ label: `Copia de seguridad creada${by(r)}`, icon: "bi-archive", tone: "info" }),
	backupLoad: (r) => ({ label: `Copia de seguridad restaurada${by(r)}`, icon: "bi-archive", tone: "info" }),
	backupDelete: (r) => ({ label: `Copia de seguridad eliminada${by(r)}`, icon: "bi-archive", tone: "info" }),
	channelCreate: (r) => ({ label: `Canal creado${by(r)}`, icon: "bi-plus-square", tone: "success" }),
	channelDelete: (r) => ({ label: `Canal eliminado${by(r)}`, icon: "bi-dash-square", tone: "success" }),
	createInvite: (r) => ({ label: `Invitación creada${by(r)}`, icon: "bi-link-45deg", tone: "success" }),
	setIcon: (r) => ({ label: `Icono del servidor cambiado${by(r)}`, icon: "bi-image", tone: "success" }),
	setName: (r) => ({ label: `Nombre del servidor cambiado${by(r)}`, icon: "bi-pencil", tone: "success" }),
	addRole: (r) => ({ label: `Rol añadido a ${user(r.targetId)}${by(r)}`, icon: "bi-person-plus", tone: "success" }),
	removeRole: (r) => ({ label: `Rol quitado a ${user(r.targetId)}${by(r)}`, icon: "bi-person-dash", tone: "success" }),
	setNickname: (r) => ({ label: `Apodo de ${user(r.targetId)} cambiado${by(r)}`, icon: "bi-person-lines-fill", tone: "success" }),
	unnukeBans: (r) => ({ label: `Unnuke: baneos eliminados${by(r)}`, icon: "bi-arrow-counterclockwise", tone: "info" }),
	unnukeChannels: (r) => ({ label: `Unnuke: canales duplicados eliminados${by(r)}`, icon: "bi-arrow-counterclockwise", tone: "info" }),
	unnukeRoles: (r) => ({ label: `Unnuke: roles duplicados eliminados${by(r)}`, icon: "bi-arrow-counterclockwise", tone: "info" }),
	unnukeEmojis: (r) => ({ label: `Unnuke: emojis duplicados eliminados${by(r)}`, icon: "bi-arrow-counterclockwise", tone: "info" }),
	markMalicious: (r) => ({ label: `${user(r.targetId)} marcado como malicioso${by(r)}`, icon: "bi-person-fill-x", tone: "warning" }),
	unmarkMalicious: (r) => ({ label: `${user(r.targetId)} ya no está marcado como malicioso${by(r)}`, icon: "bi-person-check", tone: "success" }),
};

/**
 * turns a raw activity row into the label, icon and tone shown in the ui.
 * @param row - the activity row read from the database.
 * @returns the presentation-ready activity.
 */
export function describeActivity(row: ActivityRow): Activity {
	const table = row.source === "event" ? EVENTS : ACTION_TYPES;
	// a type the web doesn't know yet (the bot may be newer) is shown as-is
	// instead of being hidden.
	const p: Presentation = table[row.type]?.(row) ?? { label: `${row.type}${row.targetId ? ` (${row.targetId})` : ""}`, icon: "bi-dot", tone: "info" };
	return { id: `${row.source}-${row.id}`, type: row.type, at: row.createdAt, ...p };
}
