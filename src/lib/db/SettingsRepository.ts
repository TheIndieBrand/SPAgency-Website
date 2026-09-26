import { getSql, isoUtc } from "./client";

// Registro de ajustes: la fuente única de qué se puede cambiar desde la web, con
// su tabla, columna, tipo y límites. La API valida contra esto (nunca se fía de
// lo que manda el navegador) y de aquí salen también los nombres de tabla y
// columna de cada UPDATE: no llegan del cliente. Las claves son los nombres de
// los campos de `GuildConfig`, únicos en todo el panel.

type Table = "guilds" | "guild_protection" | "guild_moderation" | "guild_configuration";

const SECONDS = { s: 1, m: 60, h: 3600, d: 86_400, w: 604_800 } as const;
type Unit = keyof typeof SECONDS;

interface Base {
	table: Table;
	column: string;
	label: string;
}

type Spec =
	| (Base & { kind: "boolean" })
	| (Base & { kind: "enum"; values: readonly string[] })
	| (Base & { kind: "int"; min: number; max: number })
	// Duración como la guarda el bot: "30d", "15m"... (mismo formato que su parser).
	| (Base & { kind: "duration"; units: readonly Unit[]; minSeconds: number; maxSeconds: number })
	// ID de Discord o null (vacío = sin valor).
	| (Base & { kind: "snowflake" })
	| (Base & { kind: "text"; pattern: RegExp; message: string })
	// Lista de textos (`text[]`): se cambia elemento a elemento, no entera.
	| (Base & { kind: "list"; item: "snowflake" | "text"; max: number; maxLength: number });

const SNOWFLAKE = /^\d{15,25}$/;
const day = SECONDS.d;

const guildProtection = (column: string, label: string) => ({ table: "guild_protection" as const, column, label });
const guildModeration = (column: string, label: string) => ({ table: "guild_moderation" as const, column, label });

export const SETTINGS: Record<string, Spec> = {
	// Protección
	antiraidEnable: { kind: "boolean", ...guildProtection("antiraid_enable", "Anti-Raid") },
	antibotsEnable: { kind: "boolean", ...guildProtection("antibots_enable", "Anti-Bots") },
	antibotsType: { kind: "enum", values: ["all", "onlyUnverified"], ...guildProtection("antibots_type", "Alcance del Anti-Bots") },
	selfbotAction: { kind: "enum", values: ["none", "kick", "ban"], ...guildProtection("selfbot_action", "Acción contra selfbots") },
	selfbotMinAccountAge: { kind: "duration", units: ["h", "d", "w"], minSeconds: 3600, maxSeconds: 365 * day, ...guildProtection("selfbot_min_account_age", "Antigüedad mínima de cuenta") },
	maliciousMemberAction: { kind: "enum", values: ["none", "mark", "ban"], ...guildProtection("malicious_member_action", "Acción contra miembros maliciosos") },
	verificationEnable: { kind: "boolean", ...guildProtection("verification_enable", "Verificación") },
	verificationRole: { kind: "snowflake", ...guildProtection("verification_role", "Rol de verificación") },
	intelligentSosEnable: { kind: "boolean", ...guildProtection("intelligent_sos_enable", "SOS Inteligente") },
	raidmodeEnable: { kind: "boolean", ...guildProtection("raidmode_enable", "Modo Pánico") },
	raidmodeTimeToDisable: { kind: "duration", units: ["m", "h", "d", "w"], minSeconds: 5 * 60, maxSeconds: 30 * day, ...guildProtection("raidmode_time_to_disable", "Duración del Modo Pánico") },

	// Automoderación
	antiflood: { kind: "boolean", ...guildModeration("antiflood", "Anti-flood de mensajes") },
	antiWebhooksFlood: { kind: "boolean", ...guildModeration("anti_webhooks_flood", "Anti-flood de webhooks") },
	ghostpingEnable: { kind: "boolean", ...guildModeration("ghostping_enable", "Ghost-pings") },
	capsLockEnable: { kind: "boolean", ...guildModeration("caps_lock_enable", "Filtro de mayúsculas") },
	capsLockThreshold: { kind: "int", min: 1, max: 100, ...guildModeration("caps_lock_threshold", "Umbral de mayúsculas") },
	manyEmojisEnable: { kind: "boolean", ...guildModeration("many_emojis_enable", "Filtro de emojis") },
	manyEmojisThreshold: { kind: "int", min: 1, max: 200, ...guildModeration("many_emojis_threshold", "Umbral de emojis") },
	manyWordsEnable: { kind: "boolean", ...guildModeration("many_words_enable", "Filtro de mensajes largos") },
	manyWordsThreshold: { kind: "int", min: 1, max: 1000, ...guildModeration("many_words_threshold", "Umbral de palabras") },
	automodMuteAt: { kind: "int", min: 1, max: 50, ...guildModeration("automod_mute_at", "Silenciar a partir de") },
	// El máximo de un timeout en Discord son 28 días.
	automodMuteMinutes: { kind: "int", min: 1, max: 40_320, ...guildModeration("automod_mute_minutes", "Duración del silencio") },
	automodFinalAction: { kind: "enum", values: ["none", "kick", "ban"], ...guildModeration("automod_final_action", "Acción final") },
	automodFinalActionAt: { kind: "int", min: 1, max: 100, ...guildModeration("automod_final_action_at", "Acción final a partir de") },
	forceReasons: { kind: "list", item: "text", max: 25, maxLength: 100, ...guildModeration("force_reasons", "Razones predefinidas") },

	// Alertas y canales
	logsChannel: { kind: "snowflake", table: "guild_configuration", column: "logs_channel", label: "Canal de logs" },
	whitelist: { kind: "list", item: "snowflake", max: 100, maxLength: 25, table: "guild_configuration", column: "whitelist", label: "Lista blanca" },

	// Ajustes generales
	prefix: { kind: "text", pattern: /^\S{1,5}$/, message: "El prefijo tiene entre 1 y 5 caracteres, sin espacios.", table: "guilds", column: "prefix", label: "Prefijo" },
	language: { kind: "enum", values: ["es", "en"], table: "guilds", column: "language", label: "Idioma" },
};

// ── Resultado ───────────────────────────────────────────────────────────────

export type ChangeInput = { key: string; value?: unknown; op?: "add" | "remove" };

export type ChangeResult =
	| { ok: true; key: string; value: unknown; old: unknown; activatedAt?: string | null }
	| { ok: false; status: 400 | 404 | 422 | 503; error: string; message: string };

const fail = (status: 400 | 404 | 422 | 503, error: string, message: string): ChangeResult => ({ ok: false, status, error, message });

// ── Validación de un valor suelto ───────────────────────────────────────────

type Parsed = { ok: true; value: unknown } | { ok: false; message: string };

const bad = (message: string): Parsed => ({ ok: false, message });

export function parseDuration(value: unknown, spec: Extract<Spec, { kind: "duration" }>): Parsed {
	const match = typeof value === "string" ? /^(\d{1,4})([smhdw])$/.exec(value.trim().toLowerCase()) : null;
	if (!match || !(spec.units as readonly string[]).includes(match[2])) {
		return bad(`Indica una cantidad y una unidad válidas (${spec.units.join(", ")}).`);
	}
	const seconds = Number(match[1]) * SECONDS[match[2] as Unit];
	if (seconds < spec.minSeconds) return bad(`Como mínimo ${humanSeconds(spec.minSeconds)}.`);
	if (seconds > spec.maxSeconds) return bad(`Como máximo ${humanSeconds(spec.maxSeconds)}.`);
	return { ok: true, value: `${Number(match[1])}${match[2]}` };
}

function humanSeconds(s: number): string {
	if (s % day === 0) return `${s / day} día${s / day === 1 ? "" : "s"}`;
	if (s % 3600 === 0) return `${s / 3600} hora${s / 3600 === 1 ? "" : "s"}`;
	return `${Math.round(s / 60)} minutos`;
}

export function parseValue(spec: Spec, value: unknown): Parsed {
	switch (spec.kind) {
		case "boolean":
			return typeof value === "boolean" ? { ok: true, value } : bad("Valor no válido.");
		case "enum":
			return typeof value === "string" && spec.values.includes(value) ? { ok: true, value } : bad("Opción no válida.");
		case "int": {
			const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
			if (typeof n !== "number" || !Number.isInteger(n)) return bad("Escribe un número entero.");
			if (n < spec.min || n > spec.max) return bad(`Debe estar entre ${spec.min} y ${spec.max}.`);
			return { ok: true, value: n };
		}
		case "duration":
			return parseDuration(value, spec);
		case "snowflake": {
			if (value === null || (typeof value === "string" && value.trim() === "")) return { ok: true, value: null };
			return typeof value === "string" && SNOWFLAKE.test(value.trim())
				? { ok: true, value: value.trim() }
				: bad("Un ID de Discord son entre 15 y 25 dígitos (con el modo desarrollador, clic derecho → Copiar ID).");
		}
		case "text":
			return typeof value === "string" && spec.pattern.test(value.trim()) ? { ok: true, value: value.trim() } : bad(spec.message);
		case "list":
			return bad("Las listas se cambian añadiendo o quitando un elemento.");
	}
}

function parseItem(spec: Extract<Spec, { kind: "list" }>, value: unknown): Parsed {
	if (typeof value !== "string") return bad("Valor no válido.");
	const item = value.replace(/\s+/g, " ").trim();
	if (!item) return bad("No puede estar vacío.");
	if (item.length > spec.maxLength) return bad(`Máximo ${spec.maxLength} caracteres.`);
	if (spec.item === "snowflake" && !SNOWFLAKE.test(item)) {
		return bad("Un ID de Discord son entre 15 y 25 dígitos (clic derecho → Copiar ID).");
	}
	return { ok: true, value: item };
}

// ── Escritura ───────────────────────────────────────────────────────────────

const idColumn = (table: Table) => (table === "guilds" ? "id" : "guild_id");

/**
 * validates and writes a single guild setting change against the shared
 * `SETTINGS` registry.
 *
 * every query here mirrors what already existed — this class only wraps
 * them, it never changes a column, a table or what a query returns.
 */
export class SettingsRepository {
	/**
	 * validates one change against the settings registry and writes it.
	 * @param guildId - the discord guild id.
	 * @param input - the setting key, and the new value or list operation.
	 * @returns the applied change, or why it failed.
	 */
	async changeSetting(guildId: string, input: ChangeInput): Promise<ChangeResult> {
		const spec = Object.hasOwn(SETTINGS, input.key) ? SETTINGS[input.key] : undefined;
		if (!spec) return fail(400, "unknown_setting", "Ese ajuste no existe.");

		try {
			const sql = getSql();
			const key = idColumn(spec.table);

			const [current] = await sql`select ${sql(spec.column)} as value from ${sql(spec.table)} where ${sql(key)} = ${guildId}`;
			if (!current) return fail(404, "not_found", "Este servidor todavía no tiene configuración.");

			// ── Listas: añadir o quitar un elemento ───────────────────────────────
			if (spec.kind === "list") {
				if (input.op !== "add" && input.op !== "remove") return fail(400, "invalid_body", "Operación no válida.");
				const item = parseItem(spec, input.value);
				if (!item.ok) return fail(422, "invalid_value", item.message);

				const list = current.value as string[];
				const present = list.includes(item.value as string);
				if (input.op === "add" && !present) {
					if (list.length >= spec.max) return fail(422, "list_full", `Máximo ${spec.max} elementos.`);
					const [row] = await sql`
						update ${sql(spec.table)} set ${sql(spec.column)} = array_append(${sql(spec.column)}, ${item.value as string})
						where ${sql(key)} = ${guildId} returning ${sql(spec.column)} as value`;
					return { ok: true, key: input.key, value: row.value, old: list };
				}
				if (input.op === "remove" && present) {
					const [row] = await sql`
						update ${sql(spec.table)} set ${sql(spec.column)} = array_remove(${sql(spec.column)}, ${item.value as string})
						where ${sql(key)} = ${guildId} returning ${sql(spec.column)} as value`;
					return { ok: true, key: input.key, value: row.value, old: list };
				}
				// Ya estaba (o ya no estaba): el resultado es el que se pedía.
				return { ok: true, key: input.key, value: list, old: list };
			}

			// ── Valores sueltos ───────────────────────────────────────────────────
			const parsed = parseValue(spec, input.value);
			if (!parsed.ok) return fail(422, "invalid_value", parsed.message);
			const value = parsed.value;

			// Reglas que dependen de otro ajuste.
			if (input.key === "verificationEnable" && value === true) {
				const [p] = await sql`select verification_role from guild_protection where guild_id = ${guildId}`;
				if (!p?.verificationRole) return fail(422, "needs_role", "Indica primero el rol que se concede al verificar.");
			}
			if (input.key === "verificationRole" && value === null) {
				const [p] = await sql`select verification_enable from guild_protection where guild_id = ${guildId}`;
				if (p?.verificationEnable) return fail(422, "verification_active", "Desactiva la verificación antes de quitar el rol.");
			}

			// El Modo Pánico va acompañado de su fecha de activación: el auto-apagado del
			// bot se programa a partir de ella (RaidmodeExpiry), así que sin fecha no se
			// apagaría nunca. Se fija al pasar de apagado a encendido, y se borra al apagar.
			// La fecha es UTC sin zona, igual que las que escribe el bot.
			if (input.key === "raidmodeEnable") {
				const on = value as boolean;
				const [row] = await sql`
					update guild_protection set
						raidmode_enable = ${on},
						raidmode_activated_at = case
							when ${on}::boolean then (case when raidmode_enable then raidmode_activated_at else (now() at time zone 'utc') end)
							else null end
					where guild_id = ${guildId}
					returning raidmode_enable as value, ${sql.unsafe(isoUtc("raidmode_activated_at"))} as activated_at`;
				return { ok: true, key: input.key, value: row.value, old: current.value, activatedAt: row.activatedAt };
			}

			const [row] = await sql`
				update ${sql(spec.table)} set ${sql(spec.column)} = ${value as string | number | boolean | null}
				where ${sql(key)} = ${guildId} returning ${sql(spec.column)} as value`;
			return { ok: true, key: input.key, value: row.value, old: current.value };
		} catch (error) {
			console.error("[db] no se pudo guardar el ajuste:", error instanceof Error ? error.message : error);
			return fail(503, "unavailable", "No se pudo guardar: la base de datos no responde. Inténtalo de nuevo.");
		}
	}
}

export const settingsRepository = new SettingsRepository();

// ── Para el asistente ───────────────────────────────────────────────────────
// Validación y texto de un cambio SIN tocar la base: el asistente propone y el
// usuario confirma, y la propuesta debe salir ya normalizada y legible. La
// escritura real sigue siendo `changeSetting` (que vuelve a validar todo).

export type CheckedChange = { key: string; label: string; value: unknown; op?: "add" | "remove" };

export function checkChange(input: { key?: unknown; value?: unknown; op?: unknown }): { ok: true; change: CheckedChange } | { ok: false; message: string } {
	const key = typeof input.key === "string" ? input.key : "";
	const spec = Object.hasOwn(SETTINGS, key) ? SETTINGS[key] : undefined;
	if (!spec) return { ok: false, message: `El ajuste «${key.slice(0, 40)}» no existe.` };

	if (spec.kind === "list") {
		if (input.op !== "add" && input.op !== "remove") return { ok: false, message: `${spec.label}: indica si añadir o quitar un elemento.` };
		const item = parseItem(spec, input.value);
		return item.ok ? { ok: true, change: { key, label: spec.label, value: item.value, op: input.op } } : { ok: false, message: `${spec.label}: ${item.message}` };
	}
	const parsed = parseValue(spec, input.value);
	return parsed.ok ? { ok: true, change: { key, label: spec.label, value: parsed.value } } : { ok: false, message: `${spec.label}: ${parsed.message}` };
}

export function formatSettingValue(value: unknown): string {
	if (value === true) return "activado";
	if (value === false) return "desactivado";
	if (value === null || value === undefined || value === "") return "sin definir";
	if (Array.isArray(value)) return value.length ? `${value.length} elemento${value.length === 1 ? "" : "s"}` : "vacía";
	return String(value);
}

// Una línea por ajuste para el contexto del modelo: `clave=valor pista # etiqueta`.
// Es lo único que necesita para proponer (claves exactas, opciones y rangos).
export function settingsLegend(read: (key: string) => unknown): string {
	const rows: string[] = [];
	for (const [key, spec] of Object.entries(SETTINGS)) {
		const value = read(key);
		let shown: string;
		if (Array.isArray(value)) {
			const items = value.slice(0, 15).map((v) => String(v).replace(/[\s"<>]+/g, " ").slice(0, 40));
			shown = `[${items.join(", ")}${value.length > 15 ? ` +${value.length - 15} más` : ""}]`;
		} else shown = value === null || value === undefined ? "null" : String(value);
		const hint =
			spec.kind === "enum" ? ` [${spec.values.join("|")}]`
			: spec.kind === "int" ? ` (${spec.min}-${spec.max})`
			: spec.kind === "duration" ? ` (${humanShort(spec.minSeconds)}-${humanShort(spec.maxSeconds)}, ${spec.units.join("/")})`
			: spec.kind === "list" ? ` (op add/remove, máx ${spec.max})`
			: "";
		rows.push(`${key}=${shown}${hint} # ${spec.label}`);
	}
	return rows.join("\n");
}

function humanShort(s: number): string {
	return s % day === 0 ? `${s / day}d` : s % 3600 === 0 ? `${s / 3600}h` : `${Math.round(s / 60)}m`;
}

// Secciones de la configuración por ajuste, para /config.
export const SETTING_SECTIONS: Record<string, string[]> = {
	proteccion: ["antiraidEnable", "antibotsEnable", "antibotsType", "selfbotAction", "selfbotMinAccountAge", "maliciousMemberAction", "verificationEnable", "verificationRole", "intelligentSosEnable", "raidmodeEnable", "raidmodeTimeToDisable"],
	automoderacion: ["antiflood", "antiWebhooksFlood", "ghostpingEnable", "capsLockEnable", "capsLockThreshold", "manyEmojisEnable", "manyEmojisThreshold", "manyWordsEnable", "manyWordsThreshold", "automodMuteAt", "automodMuteMinutes", "automodFinalAction", "automodFinalActionAt", "forceReasons"],
	alertas: ["logsChannel", "whitelist"],
	general: ["prefix", "language"],
};

export const settingLabel = (key: string): string => (Object.hasOwn(SETTINGS, key) ? SETTINGS[key].label : key);
