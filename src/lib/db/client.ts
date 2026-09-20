import postgres from "postgres";

// Conexión a la base de SP Agency (la del bot). La web entra con el rol
// `spagency_web`, que solo puede leer configuración, registros y advertencias y
// actualizar los ajustes: aunque hubiera un fallo en una consulta, no puede
// insertar, borrar ni cambiar el esquema (eso lo lleva el bot con sus migraciones).

export class DatabaseNotConfigured extends Error {
	constructor() {
		super("DATABASE_URL no está definida");
	}
}

export function dbConfigured(): boolean {
	return Boolean(process.env.DATABASE_URL);
}

let sql: postgres.Sql | null = null;

export function getSql(): postgres.Sql {
	const url = process.env.DATABASE_URL;
	if (!url) throw new DatabaseNotConfigured();

	// Un pool pequeño: la web hace pocas consultas y comparte servidor con el bot.
	// Las columnas llegan en camelCase. Los avisos de Postgres no son errores.
	sql ??= postgres(url, {
		max: 5,
		idle_timeout: 30,
		connect_timeout: 10,
		onnotice: () => {},
		transform: { column: { from: postgres.toCamel } },
	});
	return sql;
}

// Las columnas `timestamp` de la base no llevan zona horaria y su reloj está
// fijado en UTC (`ALTER DATABASE spagency SET timezone TO 'UTC'`), igual que las
// fechas que escribe el bot desde JS. Se leen siempre como texto ISO en UTC para
// no depender de cómo interprete el driver una fecha sin zona.
export const isoUtc = (column: string) => `to_char(${column}, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;
