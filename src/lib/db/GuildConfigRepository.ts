import { getGuildOwnerId } from "../discord";
import { getSql, isoUtc } from "./client";

// Configuración de un servidor, tal como la guarda el bot en `guilds`,
// `guild_protection`, `guild_moderation` y `guild_configuration` (el bot crea las
// cuatro filas a la vez al entrar en el servidor).

export interface GuildConfig {
	core: {
		prefix: string;
		language: "es" | "en";
	};
	protection: {
		antiraidEnable: boolean;
		antibotsEnable: boolean;
		antibotsType: "all" | "onlyUnverified";
		selfbotAction: "none" | "kick" | "ban";
		selfbotMinAccountAge: string;
		maliciousMemberAction: "none" | "mark" | "ban";
		verificationEnable: boolean;
		verificationRole: string | null;
		intelligentSosEnable: boolean;
		raidmodeEnable: boolean;
		raidmodeTimeToDisable: string;
		// ISO en UTC, o null si el modo pánico está apagado.
		raidmodeActivatedAt: string | null;
	};
	moderation: {
		forceReasons: string[];
		antiflood: boolean;
		antiWebhooksFlood: boolean;
		ghostpingEnable: boolean;
		capsLockEnable: boolean;
		capsLockThreshold: number;
		manyEmojisEnable: boolean;
		manyEmojisThreshold: number;
		manyWordsEnable: boolean;
		manyWordsThreshold: number;
		automodMuteAt: number;
		automodMuteMinutes: number;
		automodFinalAction: "none" | "kick" | "ban";
		automodFinalActionAt: number;
	};
	configuration: {
		// IDs de Discord de usuarios y bots exentos.
		whitelist: string[];
		logsChannel: string | null;
	};
}

// Por qué no se pudo dar la configuración: el bot aún no ha creado las filas de
// este servidor (`missing`) o la base no responde (`unavailable`).
export type ConfigResult = { ok: true; config: GuildConfig } | { ok: false; reason: "missing" | "unavailable" };

/**
 * reads and writes a guild's configuration rows, shared with the discord bot.
 *
 * every query here mirrors what the bot itself already runs — this class only
 * wraps them, it never changes a column, a table or what a query returns.
 */
export class GuildConfigRepository {
	/**
	 * loads a guild's full configuration.
	 * @param guildId - the discord guild id.
	 * @returns the config, or why it could not be loaded.
	 */
	async loadGuildConfig(guildId: string): Promise<ConfigResult> {
		try {
			const sql = getSql();
			const [r] = await sql`
				select
					g.prefix, g.language,
					p.antiraid_enable, p.antibots_enable, p.antibots_type, p.selfbot_action, p.selfbot_min_account_age,
					p.malicious_member_action, p.verification_enable, p.verification_role, p.intelligent_sos_enable,
					p.raidmode_enable, p.raidmode_time_to_disable,
					${sql.unsafe(isoUtc("p.raidmode_activated_at"))} as raidmode_activated_at,
					m.force_reasons, m.antiflood, m.anti_webhooks_flood, m.ghostping_enable,
					m.caps_lock_enable, m.caps_lock_threshold, m.many_emojis_enable, m.many_emojis_threshold,
					m.many_words_enable, m.many_words_threshold,
					m.automod_mute_at, m.automod_mute_minutes, m.automod_final_action, m.automod_final_action_at,
					c.whitelist, c.logs_channel
				from guilds g
				join guild_protection p on p.guild_id = g.id
				join guild_moderation m on m.guild_id = g.id
				join guild_configuration c on c.guild_id = g.id
				where g.id = ${guildId}
			`;
			if (!r) return { ok: false, reason: "missing" };

			return {
				ok: true,
				config: {
					core: { prefix: r.prefix, language: r.language === "en" ? "en" : "es" },
					protection: {
						antiraidEnable: r.antiraidEnable,
						antibotsEnable: r.antibotsEnable,
						antibotsType: r.antibotsType,
						selfbotAction: r.selfbotAction,
						selfbotMinAccountAge: r.selfbotMinAccountAge,
						maliciousMemberAction: r.maliciousMemberAction,
						verificationEnable: r.verificationEnable,
						verificationRole: r.verificationRole,
						intelligentSosEnable: r.intelligentSosEnable,
						raidmodeEnable: r.raidmodeEnable,
						raidmodeTimeToDisable: r.raidmodeTimeToDisable,
						raidmodeActivatedAt: r.raidmodeActivatedAt,
					},
					moderation: {
						forceReasons: r.forceReasons,
						antiflood: r.antiflood,
						antiWebhooksFlood: r.antiWebhooksFlood,
						ghostpingEnable: r.ghostpingEnable,
						capsLockEnable: r.capsLockEnable,
						capsLockThreshold: r.capsLockThreshold,
						manyEmojisEnable: r.manyEmojisEnable,
						manyEmojisThreshold: r.manyEmojisThreshold,
						manyWordsEnable: r.manyWordsEnable,
						manyWordsThreshold: r.manyWordsThreshold,
						automodMuteAt: r.automodMuteAt,
						automodMuteMinutes: r.automodMuteMinutes,
						automodFinalAction: r.automodFinalAction,
						automodFinalActionAt: r.automodFinalActionAt,
					},
					configuration: { whitelist: r.whitelist, logsChannel: r.logsChannel },
				},
			};
		} catch (error) {
			console.error("[db] no se pudo leer la configuración del servidor:", error instanceof Error ? error.message : error);
			return { ok: false, reason: "unavailable" };
		}
	}

	/**
	 * creates a guild's four config rows with the database's own defaults, same
	 * as the bot does on join. `on conflict do nothing`: safe if the bot (or
	 * another request) creates them at the same time.
	 * @param guildId - the discord guild id.
	 * @param ownerId - the guild owner's discord id.
	 */
	private async createGuildConfig(guildId: string, ownerId: string): Promise<void> {
		await getSql().begin(async (tx) => {
			await tx`insert into guilds (id, owner_id) values (${guildId}, ${ownerId}) on conflict (id) do nothing`;
			await tx`insert into guild_protection (guild_id) values (${guildId}) on conflict (guild_id) do nothing`;
			await tx`insert into guild_moderation (guild_id) values (${guildId}) on conflict (guild_id) do nothing`;
			await tx`insert into guild_configuration (guild_id) values (${guildId}) on conflict (guild_id) do nothing`;
		});
	}

	/**
	 * loads a guild's configuration, creating it first if the bot hasn't yet
	 * (a guild it joined before the database existed, or while it was down).
	 * only called after checking the user is an admin and the bot is in the guild.
	 * @param guildId - the discord guild id.
	 * @returns the config, or why it could not be loaded.
	 */
	async loadOrCreateGuildConfig(guildId: string): Promise<ConfigResult> {
		const first = await this.loadGuildConfig(guildId);
		if (first.ok || first.reason !== "missing") return first;

		try {
			const ownerId = await getGuildOwnerId(guildId);
			if (!ownerId) return { ok: false, reason: "unavailable" };
			await this.createGuildConfig(guildId, ownerId);
		} catch (error) {
			console.error("[db] no se pudo crear la configuración del servidor:", error instanceof Error ? error.message : error);
			return { ok: false, reason: "unavailable" };
		}
		return this.loadGuildConfig(guildId);
	}

	/**
	 * reads a guild's latest backup date, if it has one. only the date: the web
	 * has no access to the backup's contents.
	 * @param guildId - the discord guild id.
	 * @returns an iso utc date, or null if there is no backup.
	 */
	async getLastBackup(guildId: string): Promise<string | null> {
		try {
			const sql = getSql();
			const [row] = await sql`select ${sql.unsafe(isoUtc("created_at"))} as created_at from backups where guild_id = ${guildId}`;
			return row?.createdAt ?? null;
		} catch {
			return null;
		}
	}
}

export const guildConfigRepository = new GuildConfigRepository();
