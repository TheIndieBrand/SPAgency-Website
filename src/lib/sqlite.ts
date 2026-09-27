import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

// opens (and creates if needed) a sqlite file. the path comes from an
// environment variable, so it can be pointed at a persistent disk in production.
export function openDatabase(envVar: string, fallback: string): DatabaseSync {
	const file = resolve(process.env[envVar] || fallback);
	mkdirSync(dirname(file), { recursive: true });
	return new DatabaseSync(file);
}
