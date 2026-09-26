import { recordSettingChange } from "../audit";
import { listAccessibleGuilds, resolveGuildAccess } from "../dashboard-guard";
import { activityRepository, describeActivity } from "../db/ActivityRepository";
import { guildConfigRepository, type GuildConfig } from "../db/GuildConfigRepository";
import {
	SETTING_SECTIONS,
	checkChange,
	formatSettingValue,
	settingLabel,
	settingsLegend,
	settingsRepository,
	type CheckedChange,
} from "../db/SettingsRepository";
import { MAX_SETTING_CHANGES } from "./config";
import { chatRepository } from "./ChatRepository";

// the assistant's dashboard integration. three pieces:
//   · which guild it acts on (chosen by the user, checked on every use),
//   · the context given to the model (only when the message talks about settings),
//   · turning what it proposes into a validated proposal and, once the user
//     confirms, applying it with the same `changeSetting` the autosave uses.
// the model never writes: it only proposes, and permission comes from the discord session.

export interface GuildRef {
	id: string;
	name: string;
}

export type Selection = { ok: true; guild: GuildRef } | { ok: false; reason: "none" | "multiple" | "unavailable" };

export interface SettingsPayload {
	guildId: string;
	guildName: string;
	changes: CheckedChange[];
}

export interface ChangeOutcome {
	label: string;
	ok: boolean;
	message: string;
	unavailable: boolean;
}

// fixed question (no model call: doesn't spend quota) when there are several
// guilds and none has been chosen yet in this conversation.
export const ASK_GUILD_TEXT =
	"Administras varios servidores y no quiero tocar el equivocado. **¿En cuál lo hago?** Elígelo abajo (o escribe `/servidor nombre`) y sigo con lo que me pedías.";

// "how do I" or "what is" questions: answered from the docs, without asking
// for a guild. only counts if the message starts this way.
const HOW_TO = /^\s*[¿¡]?\s*(c[oó]mo|qu[eé]|cu[aá]l(es)?|por qu[eé]|d[oó]nde|cu[aá]ndo|para qu[eé]|puedo|se puede)(?![a-záéíóúñ])/i;

const INTENT =
	/\b(activ|desactiv|apag|enciend|encend|cambi|pon(er|e|me|lo|la|los)?|sub(e|ir)|baj(a|ar)|quit(a|ar)|elimin|a[ñn]ad|agreg|configur|ajust|establec|habilit|deshabilit|umbral|lista blanca|whitelist|prefijo|idioma|modo p[aá]nico|enable|disable|turn|set|change)/i;

const cleanName = (name: string) => name.replace(/[\s"<>]+/g, " ").trim().slice(0, 40);
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const shown = (value: unknown) => (typeof value === "string" ? `«${value}»` : formatSettingValue(value));

/**
 * the assistant's bridge into the dashboard: resolving which guild a
 * conversation acts on, building the settings context sent to the model, and
 * turning a proposal into a validated, applied change.
 */
export class DashboardAssistantService {
	/**
	 * the guild this conversation acts on: the one chosen in it (if the user
	 * still has access), or, if they only administer one with the bot inside,
	 * that one (no ambiguity possible). with several and none chosen, nothing
	 * is guessed: `multiple`, and the user is asked. the choice isn't inherited
	 * from other conversations.
	 */
	async resolveGuild(accessToken: string, conversationId?: string): Promise<Selection> {
		try {
			const saved = conversationId ? chatRepository.getConversationGuild(conversationId) : null;
			if (saved) {
				const access = await resolveGuildAccess(accessToken, saved.id);
				if ("guild" in access) return { ok: true, guild: { id: access.guild.id, name: access.guild.name } };
			}
			const guilds = await listAccessibleGuilds(accessToken);
			if (!guilds || !guilds.length) return { ok: false, reason: guilds ? "none" : "unavailable" };
			if (guilds.length > 1) return { ok: false, reason: "multiple" };
			const only = { id: guilds[0].id, name: guilds[0].name };
			if (conversationId) chatRepository.setConversationGuild(conversationId, only);
			return { ok: true, guild: only };
		} catch (error) {
			console.error("[chat] failed to resolve the guild:", error instanceof Error ? error.message : error);
			return { ok: false, reason: "unavailable" };
		}
	}

	readSetting(config: GuildConfig, key: string): unknown {
		for (const section of [config.core, config.protection, config.moderation, config.configuration] as Record<string, unknown>[]) {
			if (Object.hasOwn(section, key)) return section[key];
		}
		return undefined;
	}

	isHowTo(text: string): boolean {
		return HOW_TO.test(text);
	}

	wantsSettings(text: string): boolean {
		return INTENT.test(text);
	}

	// ── context for the model ───────────────────────────────────────────────

	/** only messages that talk about settings carry this block (~400 tokens): every other question pays nothing for it. */
	settingsContext(guild: GuildRef, config: GuildConfig): string {
		return `<ajustes servidor="${cleanName(guild.name)}">\n${settingsLegend((key) => this.readSetting(config, key))}\n</ajustes>`;
	}

	noGuildContext(reason: "none" | "multiple" | "unavailable"): string {
		const why =
			reason === "multiple"
				? "el usuario administra varios servidores y no ha elegido cuál: dile que escriba /servidor"
				: reason === "none"
					? "el usuario no administra ningún servidor con SP Agency dentro"
					: "no se pudo comprobar sus servidores ahora mismo";
		return `<ajustes>(sin servidor: ${why})</ajustes>`;
	}

	// ── proposals ────────────────────────────────────────────────────────────

	/**
	 * turns what the model proposes (not trusted) into validated changes.
	 * anything invalid, or already as requested, is left out of the proposal
	 * and explained in `problems` (which can accompany a valid proposal: the
	 * user needs to know what's missing).
	 */
	buildSettingsProposal(
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
			const current = this.readSetting(config, change.key);
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

	/** re-validated on confirm: the proposal's base is local, but the settings registry may have changed since. */
	parsePayload(raw: string | null): SettingsPayload | null {
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

	/**
	 * applies the changes in order, one at a time (some depend on others: the
	 * role first, then enabling verification). each one goes through the same
	 * validation and rules as the autosave, and is logged as done by the assistant.
	 */
	async applySettings(payload: SettingsPayload, userId: string): Promise<ChangeOutcome[]> {
		const outcomes: ChangeOutcome[] = [];
		for (const change of payload.changes) {
			const result = await settingsRepository.changeSetting(payload.guildId, { key: change.key, value: change.value, op: change.op });
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

	outcomeNote(payload: SettingsPayload, outcomes: ChangeOutcome[]): string {
		const rows = outcomes.map((o) => (o.ok ? `- ✅ ${o.label}` : `- ❌ ${o.label}: ${o.message}`));
		const head = outcomes.every((o) => o.ok) ? "Cambios aplicados" : outcomes.some((o) => o.ok) ? "Cambios aplicados a medias" : "No se ha aplicado ningún cambio";
		return `${head} en **${cleanName(payload.guildName)}**:\n\n${rows.join("\n")}`;
	}

	// ── command text ─────────────────────────────────────────────────────────

	configMarkdown(guild: GuildRef, config: GuildConfig, section: string): string | null {
		const wanted = section ? Object.keys(SETTING_SECTIONS).find((s) => s.startsWith(fold(section))) : null;
		if (section && !wanted) return null;

		const blocks = Object.entries(SETTING_SECTIONS)
			.filter(([name]) => !wanted || name === wanted)
			.map(([name, keys]) => {
				const rows = keys.map((key) => {
					const value = this.readSetting(config, key);
					const text = Array.isArray(value) ? (value.length ? `${value.length}: ${value.slice(0, 8).join(", ")}${value.length > 8 ? "…" : ""}` : "vacía") : formatSettingValue(value);
					return `- ${settingLabel(key)}: **${text.replace(/[<>*_`]/g, "")}**`;
				});
				const title = { proteccion: "Protección", automoderacion: "Automoderación", alertas: "Alertas", general: "General" }[name];
				return `**${title}**\n${rows.join("\n")}`;
			});
		return `Configuración de **${cleanName(guild.name)}**:\n\n${blocks.join("\n\n")}`;
	}

	async loadConfigFor(guild: GuildRef): Promise<GuildConfig | null> {
		const loaded = await guildConfigRepository.loadOrCreateGuildConfig(guild.id);
		return loaded.ok ? loaded.config : null;
	}

	async recentActivityMarkdown(guild: GuildRef, limit = 10): Promise<string | null> {
		const rows = await activityRepository.listActivity(guild.id, limit);
		if (!rows) return null;
		if (!rows.length) return `**${cleanName(guild.name)}** aún no tiene actividad registrada.`;
		const when = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
		const lines = rows.map((row) => {
			const a = describeActivity(row);
			return `- ${when.format(new Date(a.at))} — ${a.label.replace(/[<>*_`]/g, "")}`;
		});
		return `Últimos eventos de **${cleanName(guild.name)}**:\n\n${lines.join("\n")}`;
	}

	matchGuild(guilds: GuildRef[], arg: string): GuildRef | null {
		const q = fold(arg);
		if (!q) return null;
		if (/^\d{1,2}$/.test(q) && guilds[Number(q) - 1]) return guilds[Number(q) - 1];
		return guilds.find((g) => g.id === q) ?? guilds.find((g) => fold(g.name) === q) ?? guilds.find((g) => fold(g.name).includes(q)) ?? null;
	}
}

export const dashboardAssistantService = new DashboardAssistantService();
