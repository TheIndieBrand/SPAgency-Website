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

export async function loadGuildConfig(guildId: string): Promise<ConfigResult> {
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

// Crea las cuatro filas de un servidor con los valores por defecto de la base, igual
// que hace el bot al entrar (`GuildRepository.findOrCreate`). `ON CONFLICT DO
// NOTHING`: si el bot (u otra petición) las crea a la vez, no pasa nada. El rol de la
// web solo puede insertar estas columnas; el resto lo rellenan los valores por defecto.
async function createGuildConfig(guildId: string, ownerId: string): Promise<void> {
	await getSql().begin(async (tx) => {
		await tx`insert into guilds (id, owner_id) values (${guildId}, ${ownerId}) on conflict (id) do nothing`;
		await tx`insert into guild_protection (guild_id) values (${guildId}) on conflict (guild_id) do nothing`;
		await tx`insert into guild_moderation (guild_id) values (${guildId}) on conflict (guild_id) do nothing`;
		await tx`insert into guild_configuration (guild_id) values (${guildId}) on conflict (guild_id) do nothing`;
	});
}

// Lo que usan las páginas: la configuración del servidor, creándola si aún no existe
// (servidor donde el bot ya estaba antes de existir la base, o que se le unió mientras
// estaba apagado). Solo se llama tras comprobar que el usuario es administrador del
// servidor y que el bot está dentro.
export async function loadOrCreateGuildConfig(guildId: string): Promise<ConfigResult> {
	const first = await loadGuildConfig(guildId);
	if (first.ok || first.reason !== "missing") return first;

	try {
		const ownerId = await getGuildOwnerId(guildId);
		if (!ownerId) return { ok: false, reason: "unavailable" };
		await createGuildConfig(guildId, ownerId);
	} catch (error) {
		console.error("[db] no se pudo crear la configuración del servidor:", error instanceof Error ? error.message : error);
		return { ok: false, reason: "unavailable" };
	}
	return loadGuildConfig(guildId);
}

// Fecha de la copia de seguridad del servidor, si tiene (el bot guarda una por
// servidor). Solo se lee la fecha: la web no tiene acceso al contenido de la copia.
export async function getLastBackup(guildId: string): Promise<string | null> {
	try {
		const sql = getSql();
		const [row] = await sql`select ${sql.unsafe(isoUtc("created_at"))} as created_at from backups where guild_id = ${guildId}`;
		return row?.createdAt ?? null;
	} catch {
		return null;
	}
}
