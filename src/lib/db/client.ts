import postgres from "postgres";

// connection to SP Agency's database (the bot's). the web connects with the
// `spagency_web` role, which can only read config, logs and warnings, and
// update settings: even if a query went wrong, it can't insert, delete or
// change the schema (the bot owns that, through its own migrations).

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

	// a small pool: the web makes few queries and shares the server with the
	// bot. columns arrive in camelCase. postgres notices aren't errors.
	sql ??= postgres(url, {
		max: 5,
		idle_timeout: 30,
		connect_timeout: 10,
		onnotice: () => {},
		transform: { column: { from: postgres.toCamel } },
	});
	return sql;
}

// the database's `timestamp` columns carry no time zone, and its clock is
// fixed to utc (`ALTER DATABASE spagency SET timezone TO 'UTC'`), same as the
// dates the bot writes from js. they're always read as an iso utc string so
// it never depends on how the driver interprets a zoneless date.
export const isoUtc = (column: string) => `to_char(${column}, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;
