import type { DatabaseSync } from "node:sqlite";
import { openDatabase } from "./sqlite";

// Quién cambió qué en el dashboard. La web no puede escribir en la base del bot
// (solo actualiza ajustes), así que estos cambios no quedan en sus registros:
// se anotan aquí, con el valor anterior y el nuevo, para poder responder a
// "¿quién apagó el Anti-Raid?". Es una herramienta de seguridad, no de
// monitorización: solo se escribe y se consulta a mano.

let db: DatabaseSync | null = null;

function getDb(): DatabaseSync {
	if (db) return db;
	db = openDatabase("AUDIT_DB_PATH", "data/audit.db");
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
	// Bases creadas antes de distinguir de dónde venía el cambio.
	const columns = (db.prepare("PRAGMA table_info(setting_changes)").all() as unknown as { name: string }[]).map((c) => c.name);
	if (!columns.includes("source")) db.exec("ALTER TABLE setting_changes ADD COLUMN source TEXT NOT NULL DEFAULT 'dashboard'");
	return db;
}

// `source`: el dashboard (autoguardado) o el asistente de IA (tras confirmar el usuario).
export function recordSettingChange(change: { guildId: string; userId: string; key: string; old: unknown; value: unknown; source?: "dashboard" | "assistant" }): void {
	// Que no se pueda anotar no debe impedir el cambio (ya está hecho): se avisa en el log.
	try {
		getDb()
			.prepare("INSERT INTO setting_changes (guild_id, user_id, key, old_value, new_value, at, source) VALUES (?, ?, ?, ?, ?, ?, ?)")
			.run(change.guildId, change.userId, change.key, JSON.stringify(change.old ?? null), JSON.stringify(change.value ?? null), new Date().toISOString(), change.source ?? "dashboard");
	} catch (error) {
		console.error("[audit] no se pudo anotar el cambio:", error instanceof Error ? error.message : error);
	}
}
