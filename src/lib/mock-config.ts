// Placeholder data — mirrors the shape of `guilds` / `guild_protection` /
// `guild_moderation` / `guild_configuration` in the bot's Postgres schema
// (see SPAgency/src/database/schema) so this can be swapped for a real
// `GuildRepository.get(guildId)` call once the DB is wired up.

export interface MockGuildConfig {
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
		whitelist: { id: string; label: string }[];
		logsChannel: string | null;
	};
}

export function getMockGuildConfig(): MockGuildConfig {
	return {
		core: { prefix: "sp!", language: "es" },
		protection: {
			antiraidEnable: true,
			antibotsEnable: false,
			antibotsType: "all",
			selfbotAction: "none",
			selfbotMinAccountAge: "30d",
			maliciousMemberAction: "mark",
			verificationEnable: false,
			verificationRole: null,
			intelligentSosEnable: false,
			raidmodeEnable: false,
			raidmodeTimeToDisable: "1d",
			raidmodeActivatedAt: null,
		},
		moderation: {
			forceReasons: ["Spam", "Raideo", "Lenguaje ofensivo", "Publicidad no autorizada"],
			antiflood: true,
			antiWebhooksFlood: false,
			ghostpingEnable: false,
			capsLockEnable: false,
			capsLockThreshold: 70,
			manyEmojisEnable: false,
			manyEmojisThreshold: 8,
			manyWordsEnable: false,
			manyWordsThreshold: 150,
			automodMuteAt: 3,
			automodMuteMinutes: 10,
			automodFinalAction: "none",
			automodFinalActionAt: 6,
		},
		configuration: {
			whitelist: [{ id: "123456789012345678", label: "@ModBot" }],
			logsChannel: "mod-logs",
		},
	};
}

export interface MockEventLogEntry {
	time: string;
	type: string;
	label: string;
	icon: string;
	tone: "danger" | "warning" | "info" | "success";
}

export function getMockActivity(): MockEventLogEntry[] {
	return [
		{ time: "19:42", type: "raidDetected", label: "Raid detectado y bloqueado — 6 cuentas baneadas", icon: "bi-shield-fill-exclamation", tone: "danger" },
		{ time: "19:31", type: "warn", label: "Advertencia automática a @user123 (spam)", icon: "bi-exclamation-triangle", tone: "warning" },
		{ time: "18:58", type: "automodViolation", label: "Filtro anti-spam activado en #general", icon: "bi-funnel", tone: "warning" },
		{ time: "18:40", type: "maliciousMemberJoin", label: "Cuenta marcada como maliciosa (UBFB) — @nuevo_user", icon: "bi-person-fill-x", tone: "danger" },
		{ time: "17:15", type: "backupCreate", label: "Backup del servidor creado por @admin", icon: "bi-archive", tone: "info" },
		{ time: "16:02", type: "ban", label: "@spammer99 baneado por @admin (razón: Spam)", icon: "bi-hammer", tone: "danger" },
		{ time: "14:22", type: "channelCreate", label: "Canal #eventos creado por @admin", icon: "bi-plus-square", tone: "success" },
	];
}
