import type { DatabaseSync } from "node:sqlite";
import { openDatabase } from "./sqlite";

// who changed what in the dashboard. the web can't write to the bot's
// database (it only updates settings), so these changes don't show up in its
// own logs: they're recorded here, with the old and new value, so "who turned
// off Anti-Raid?" can be answered. a security tool, not a monitoring one:
// only written and read by hand.

export type SettingChangeSource = "dashboard" | "assistant";

export interface SettingChange {
	guildId: string;
	userId: string;
	key: string;
	old: unknown;
	value: unknown;
	source?: SettingChangeSource;
}

/** the dashboard's own audit trail of settings changes, in a local sqlite database. */
export class AuditRepository {
	private database: DatabaseSync | null = null;

	private getDb(): DatabaseSync {
		if (this.database) return this.database;

		const db = openDatabase("AUDIT_DB_PATH", "data/audit.db");
		db.exec(`
			CREATE TABLE IF NOT EXISTS setting_changes (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				guild_id TEXT NOT NULL,
				user_id TEXT NOT NULL,
				key TEXT NOT NULL,
				old_value TEXT,
				new_value TEXT,
				at TEXT NOT NULL
			);
			CREATE INDEX IF NOT EXISTS setting_changes_guild ON setting_changes (guild_id, id DESC);
		`);
		// databases created before tracking where the change came from.
		const columns = (db.prepare("PRAGMA table_info(setting_changes)").all() as unknown as { name: string }[]).map((c) => c.name);
		if (!columns.includes("source")) db.exec("ALTER TABLE setting_changes ADD COLUMN source TEXT NOT NULL DEFAULT 'dashboard'");

		this.database = db;
		return db;
	}

	/**
	 * records a setting change. `source` is the dashboard (autosave) or the
	 * ai assistant (after the user confirmed).
	 * @param change - the guild, user, setting, old and new value, and its source.
	 */
	recordSettingChange(change: SettingChange): void {
		// not being able to record this must not block the change (it already
		// happened): the failure is only logged.
		try {
			this.getDb()
				.prepare("INSERT INTO setting_changes (guild_id, user_id, key, old_value, new_value, at, source) VALUES (?, ?, ?, ?, ?, ?, ?)")
				.run(change.guildId, change.userId, change.key, JSON.stringify(change.old ?? null), JSON.stringify(change.value ?? null), new Date().toISOString(), change.source ?? "dashboard");
		} catch (error) {
			console.error("[audit] failed to record the change:", error instanceof Error ? error.message : error);
		}
	}
}

export const auditRepository = new AuditRepository();
