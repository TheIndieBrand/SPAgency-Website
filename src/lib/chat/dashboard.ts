import { recordSettingChange } from "../audit";
import { listAccessibleGuilds, resolveGuildAccess } from "../dashboard-guard";
import { describeActivity, listActivity } from "../db/activity";
import { loadOrCreateGuildConfig, type GuildConfig } from "../db/guild-config";
import {
	SETTING_SECTIONS,
	changeSetting,
	checkChange,
	formatSettingValue,
	settingLabel,
	settingsLegend,
	type CheckedChange,
} from "../db/settings";
import { MAX_SETTING_CHANGES } from "./config";
import { getConversationGuild, setConversationGuild } from "./db";

// El asistente sobre el dashboard. Tres piezas:
//   · qué servidor toca (uno elegido por usuario, comprobado en cada uso),
//   · el contexto que se le da al modelo (solo cuando el mensaje habla de ajustes),
//   · convertir lo que propone en una propuesta validada y, tras confirmar el
//     usuario, aplicarla con el mismo `changeSetting` que el autoguardado.
// El modelo nunca escribe: solo propone, y el permiso sale de la sesión de Discord.

export interface GuildRef {
	id: string;
	name: string;
}

export type Selection = { ok: true; guild: GuildRef } | { ok: false; reason: "none" | "multiple" | "unavailable" };

// Servidor sobre el que se actúa en ESTA conversación: el que se eligió en ella (si el
// usuario sigue teniendo acceso) o, si solo administra uno con el bot dentro, ese (no hay
// posible confusión). Con varios y sin elegir, no se adivina: `multiple`, y se pregunta.
// La elección no se hereda de otras conversaciones.
export async function resolveGuild(accessToken: string, conversationId?: string): Promise<Selection> {
	try {
		const saved = conversationId ? getConversationGuild(conversationId) : null;
		if (saved) {
			const access = await resolveGuildAccess(accessToken, saved.id);
			if ("guild" in access) return { ok: true, guild: { id: access.guild.id, name: access.guild.name } };
		}
		const guilds = await listAccessibleGuilds(accessToken);
		if (!guilds || !guilds.length) return { ok: false, reason: guilds ? "none" : "unavailable" };
		if (guilds.length > 1) return { ok: false, reason: "multiple" };
		const only = { id: guilds[0].id, name: guilds[0].name };
		if (conversationId) setConversationGuild(conversationId, only);
		return { ok: true, guild: only };
	} catch (error) {
		console.error("[chat] no se pudo resolver el servidor:", error instanceof Error ? error.message : error);
		return { ok: false, reason: "unavailable" };
	}
}

export function readSetting(config: GuildConfig, key: string): unknown {
	for (const section of [config.core, config.protection, config.moderation, config.configuration] as Record<string, unknown>[]) {
		if (Object.hasOwn(section, key)) return section[key];
	}
	return undefined;
}

// ── Contexto para el modelo ─────────────────────────────────────────────────

// Solo los mensajes que hablan de ajustes llevan el bloque (~400 tokens): el resto
// de preguntas no pagan nada por esta función.
// Preguntas de «cómo se hace» o «qué es»: se contestan con la documentación, sin pedir
// servidor. Solo cuentan si el mensaje empieza así.
const HOW_TO = /^\s*[¿¡]?\s*(c[oó]mo|qu[eé]|cu[aá]l(es)?|por qu[eé]|d[oó]nde|cu[aá]ndo|para qu[eé]|puedo|se puede)(?![a-záéíóúñ])/i;
export const isHowTo = (text: string): boolean => HOW_TO.test(text);

const INTENT =
	/\b(activ|desactiv|apag|enciend|encend|cambi|pon(er|e|me|lo|la|los)?|sub(e|ir)|baj(a|ar)|quit(a|ar)|elimin|a[ñn]ad|agreg|configur|ajust|establec|habilit|deshabilit|umbral|lista blanca|whitelist|prefijo|idioma|modo p[aá]nico|enable|disable|turn|set|change)/i;

export const wantsSettings = (text: string): boolean => INTENT.test(text);

const cleanName = (name: string) => name.replace(/[\s"<>]+/g, " ").trim().slice(0, 40);

export function settingsContext(guild: GuildRef, config: GuildConfig): string {
	return `<ajustes servidor="${cleanName(guild.name)}">\n${settingsLegend((key) => readSetting(config, key))}\n</ajustes>`;
}

// Pregunta fija (sin llamar al modelo: no gasta cupo) cuando hay varios servidores y en
// esta conversación aún no se ha elegido uno.
export const ASK_GUILD_TEXT =
	"Administras varios servidores y no quiero tocar el equivocado. **¿En cuál lo hago?** Elígelo abajo (o escribe `/servidor nombre`) y sigo con lo que me pedías.";

export function noGuildContext(reason: "none" | "multiple" | "unavailable"): string {
	const why =
		reason === "multiple"
			? "el usuario administra varios servidores y no ha elegido cuál: dile que escriba /servidor"
			: reason === "none"
				? "el usuario no administra ningún servidor con SP Agency dentro"
				: "no se pudo comprobar sus servidores ahora mismo";
	return `<ajustes>(sin servidor: ${why})</ajustes>`;
}

// ── Propuestas ──────────────────────────────────────────────────────────────

export interface SettingsPayload {
	guildId: string;
	guildName: string;
	changes: CheckedChange[];
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const shown = (value: unknown) => (typeof value === "string" ? `«${value}»` : formatSettingValue(value));

// Convierte lo que propone el modelo (no es de fiar) en cambios validados. Lo que no
// vale, o ya está como se pide, no entra en la propuesta y se explica en `problems`
// (que puede venir junto a una propuesta válida: el usuario debe saber qué falta).
export function buildSettingsProposal(
	guild: GuildRef,
	config: GuildConfig,
	raw: unknown,
): { subject: string; summary: string; payload: SettingsPayload; problems: string[] } | { payload?: undefined; problems: string[] } {
	const problems: string[] = [];
	const changes: CheckedChange[] = [];
	const lines: string[] = [];
	const list = Array.isArray(raw) ? raw : [];
	if (list.length > MAX_SETTING_CHANGES) problems.push(`Solo preparo hasta ${MAX_SETTING_CHANGES} cambios cada vez.`);

	for (const item of list.slice(0, MAX_SETTING_CHANGES)) {
		const checked = checkChange(item && typeof item === "object" ? (item as Record<string, unknown>) : {});
		if (!checked.ok) {
			problems.push(checked.message);
			continue;
		}
		const { change } = checked;
		const current = readSetting(config, change.key);
		if (change.op) {
			const present = Array.isArray(current) && current.includes(change.value as string);
			if ((change.op === "add") === present) {
				problems.push(`${change.label}: ${shown(change.value)} ${present ? "ya estaba" : "no estaba"} en la lista.`);
				continue;
			}
			lines.push(`${change.label}: ${change.op === "add" ? "añadir" : "quitar"} ${shown(change.value)}`);
		} else {
			if (same(current, change.value)) {
				problems.push(`${change.label} ya estaba en ${shown(change.value)}.`);
				continue;
			}
			lines.push(`${change.label}: ${shown(current)} → ${shown(change.value)}`);
		}
		changes.push(change);
	}

	if (!changes.length) return { problems };
	return {
		subject: `Cambios en el servidor ${cleanName(guild.name)}`.slice(0, 90),
		summary: lines.join("\n"),
		payload: { guildId: guild.id, guildName: guild.name, changes },
		problems,
	};
}

// Lo guardado se vuelve a validar al confirmar: la base de la propuesta es local,
// pero el registro de ajustes puede haber cambiado desde entonces.
export function parsePayload(raw: string | null): SettingsPayload | null {
	try {
		const data = JSON.parse(raw ?? "") as Record<string, unknown>;
		if (typeof data.guildId !== "string" || !Array.isArray(data.changes)) return null;
		const changes: CheckedChange[] = [];
		for (const c of data.changes.slice(0, MAX_SETTING_CHANGES)) {
			const checked = checkChange(c as Record<string, unknown>);
			if (!checked.ok) return null;
			changes.push(checked.change);
		}
		return changes.length ? { guildId: data.guildId, guildName: String(data.guildName ?? ""), changes } : null;
	} catch {
		return null;
	}
}

export interface ChangeOutcome {
	label: string;
	ok: boolean;
	message: string;
	unavailable: boolean;
}

// Aplica los cambios en orden, uno a uno (algunos dependen de otros: primero el rol,
// luego activar la verificación). Cada uno pasa por la misma validación y las mismas
// reglas que el autoguardado, y queda en la auditoría como hecho por el asistente.
export async function applySettings(payload: SettingsPayload, userId: string): Promise<ChangeOutcome[]> {
	const outcomes: ChangeOutcome[] = [];
	for (const change of payload.changes) {
		const result = await changeSetting(payload.guildId, { key: change.key, value: change.value, op: change.op });
		if (!result.ok) {
			outcomes.push({ label: change.label, ok: false, message: result.message, unavailable: result.status === 503 });
			continue;
		}
		if (!same(result.old, result.value)) {
			recordSettingChange({ guildId: payload.guildId, userId, key: result.key, old: result.old, value: result.value, source: "assistant" });
		}
		outcomes.push({ label: change.label, ok: true, message: "", unavailable: false });
	}
	return outcomes;
}

export function outcomeNote(payload: SettingsPayload, outcomes: ChangeOutcome[]): string {
	const rows = outcomes.map((o) => (o.ok ? `- ✅ ${o.label}` : `- ❌ ${o.label}: ${o.message}`));
	const head = outcomes.every((o) => o.ok) ? "Cambios aplicados" : outcomes.some((o) => o.ok) ? "Cambios aplicados a medias" : "No se ha aplicado ningún cambio";
	return `${head} en **${cleanName(payload.guildName)}**:\n\n${rows.join("\n")}`;
}

// ── Textos de los comandos ──────────────────────────────────────────────────

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export function configMarkdown(guild: GuildRef, config: GuildConfig, section: string): string | null {
	const wanted = section ? Object.keys(SETTING_SECTIONS).find((s) => s.startsWith(fold(section))) : null;
	if (section && !wanted) return null;

	const blocks = Object.entries(SETTING_SECTIONS)
		.filter(([name]) => !wanted || name === wanted)
		.map(([name, keys]) => {
			const rows = keys.map((key) => {
				const value = readSetting(config, key);
				const text = Array.isArray(value) ? (value.length ? `${value.length}: ${value.slice(0, 8).join(", ")}${value.length > 8 ? "…" : ""}` : "vacía") : formatSettingValue(value);
				return `- ${settingLabel(key)}: **${text.replace(/[<>*_`]/g, "")}**`;
			});
			const title = { proteccion: "Protección", automoderacion: "Automoderación", alertas: "Alertas", general: "General" }[name];
			return `**${title}**\n${rows.join("\n")}`;
		});
	return `Configuración de **${cleanName(guild.name)}**:\n\n${blocks.join("\n\n")}`;
}

export async function loadConfigFor(guild: GuildRef): Promise<GuildConfig | null> {
	const loaded = await loadOrCreateGuildConfig(guild.id);
	return loaded.ok ? loaded.config : null;
}

export async function recentActivityMarkdown(guild: GuildRef, limit = 10): Promise<string | null> {
	const rows = await listActivity(guild.id, limit);
	if (!rows) return null;
	if (!rows.length) return `**${cleanName(guild.name)}** aún no tiene actividad registrada.`;
	const when = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
	const lines = rows.map((row) => {
		const a = describeActivity(row);
		return `- ${when.format(new Date(a.at))} — ${a.label.replace(/[<>*_`]/g, "")}`;
	});
	return `Últimos eventos de **${cleanName(guild.name)}**:\n\n${lines.join("\n")}`;
}

export const matchGuild = (guilds: GuildRef[], arg: string): GuildRef | null => {
	const q = fold(arg);
	if (!q) return null;
	if (/^\d{1,2}$/.test(q) && guilds[Number(q) - 1]) return guilds[Number(q) - 1];
	return guilds.find((g) => g.id === q) ?? guilds.find((g) => fold(g.name) === q) ?? guilds.find((g) => fold(g.name).includes(q)) ?? null;
};
