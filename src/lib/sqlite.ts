import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

// Abre (y crea si hace falta) un archivo SQLite. La ruta sale de una variable
// de entorno, para poder apuntarla en producción a un disco que persista.
export function openDatabase(envVar: string, fallback: string): DatabaseSync {
	const file = resolve(process.env[envVar] || fallback);
	mkdirSync(dirname(file), { recursive: true });
	return new DatabaseSync(file);
}
