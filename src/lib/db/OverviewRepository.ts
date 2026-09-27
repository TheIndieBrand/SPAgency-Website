import { getSql } from "./client";

// numbers for the general dashboard page. "today" and "yesterday" are madrid
// days (same as the assistant's quota reset), not utc; weeks are a rolling 7 days.

export interface Overview {
	raidsToday: number;
	raidsYesterday: number;
	maliciousWeek: number;
	maliciousPrevWeek: number;
	warnsWeek: number;
	warnsPrevWeek: number;
	autoActionsWeek: number;
	autoActionsPrevWeek: number;
}

const ZERO: Overview = {
	raidsToday: 0,
	raidsYesterday: 0,
	maliciousWeek: 0,
	maliciousPrevWeek: 0,
	warnsWeek: 0,
	warnsPrevWeek: 0,
	autoActionsWeek: 0,
	autoActionsPrevWeek: 0,
};

// event types that are an automatic bot response (not a requested action).
const AUTO_ACTIONS = ["antibotsKick", "selfbotDetected", "raidmodeJoinBan", "raidmodeActionBan", "raidBotAdderBan", "webhookFloodPurge", "raidDetected"];

// "+2 vs ayer" / "sin cambios" / "-1 vs semana pasada".
export function deltaText(current: number, previous: number, versus: string): string {
	const diff = current - previous;
	return diff === 0 ? `sin cambios ${versus}` : `${diff > 0 ? "+" : "−"}${Math.abs(diff)} ${versus}`;
}

export { ZERO as EMPTY_OVERVIEW };

// ── Tarjetas de la lista de servidores ──────────────────────────────────────
// two numbers per guild, from a single query for all of them: attacks stopped
// today (madrid day, same as the general page) and how many protection
// modules are on. the modules are the same six the general page lists.

export const MODULES_TOTAL = 6;

export interface GuildCardStats {
	raidsToday: number;
	modulesOn: number;
}

/**
 * reads the dashboard's summary numbers (raids, warns, auto-actions) from the
 * bot's own log tables.
 *
 * every query here mirrors what already existed — this class only wraps them,
 * it never changes a column, a table or what a query returns.
 */
export class OverviewRepository {
	/**
	 * gets a guild's overview numbers for the general dashboard page.
	 * @param guildId - the discord guild id.
	 * @returns the overview, or null if the query failed.
	 */
	async getOverview(guildId: string): Promise<Overview | null> {
		try {
			const sql = getSql();
			// the database's dates are utc with no zone: cast to timestamptz to
			// compare against madrid day boundaries.
			const [events] = await sql`
				with b as (
					select
						date_trunc('day', now() at time zone 'Europe/Madrid') at time zone 'Europe/Madrid' as today,
						now() as now
				)
				select
					count(*) filter (where e.type = 'raidDetected' and e.at >= b.today) as raids_today,
					count(*) filter (where e.type = 'raidDetected' and e.at >= b.today - interval '1 day' and e.at < b.today) as raids_yesterday,
					count(*) filter (where e.type = 'maliciousMemberJoin' and e.at >= b.now - interval '7 days') as malicious_week,
					count(*) filter (where e.type = 'maliciousMemberJoin' and e.at >= b.now - interval '14 days' and e.at < b.now - interval '7 days') as malicious_prev_week,
					count(*) filter (where e.type in ${sql(AUTO_ACTIONS)} and e.at >= b.now - interval '7 days') as auto_actions_week,
					count(*) filter (where e.type in ${sql(AUTO_ACTIONS)} and e.at >= b.now - interval '14 days' and e.at < b.now - interval '7 days') as auto_actions_prev_week
				from b, (
					select type, created_at at time zone 'UTC' as at
					from server_event_logs
					where guild_id = ${guildId} and created_at >= now() - interval '15 days'
				) e
			`;
			const [warns] = await sql`
				select
					count(*) filter (where w.at >= now() - interval '7 days') as warns_week,
					count(*) filter (where w.at >= now() - interval '14 days' and w.at < now() - interval '7 days') as warns_prev_week
				from (
					select created_at at time zone 'UTC' as at from warns
					where guild_id = ${guildId} and created_at >= now() - interval '15 days'
				) w
			`;

			return {
				raidsToday: Number(events.raidsToday),
				raidsYesterday: Number(events.raidsYesterday),
				maliciousWeek: Number(events.maliciousWeek),
				maliciousPrevWeek: Number(events.maliciousPrevWeek),
				autoActionsWeek: Number(events.autoActionsWeek),
				autoActionsPrevWeek: Number(events.autoActionsPrevWeek),
				warnsWeek: Number(warns.warnsWeek),
				warnsPrevWeek: Number(warns.warnsPrevWeek),
			};
		} catch (error) {
			console.error("[db] no se pudieron calcular las cifras:", error instanceof Error ? error.message : error);
			return null;
		}
	}

	/**
	 * gets today's raid count and active module count for a batch of guilds, in
	 * a single query. a guild with no config rows yet (the bot hasn't created
	 * them) is left out.
	 * @param guildIds - the discord guild ids to look up.
	 * @returns a map from guild id to its stats, or null if the query failed.
	 */
	async getGuildCardStats(guildIds: string[]): Promise<Map<string, GuildCardStats> | null> {
		if (!guildIds.length) return new Map();
		try {
			const sql = getSql();
			const rows = await sql`
				select
					g.id,
					(
						p.antiraid_enable::int + p.antibots_enable::int + (p.selfbot_action <> 'none')::int
						+ p.verification_enable::int + m.antiflood::int + (c.logs_channel is not null)::int
					) as modules_on,
					(
						select count(*) from server_event_logs e
						where e.guild_id = g.id and e.type = 'raidDetected'
							and (e.created_at at time zone 'UTC') >= date_trunc('day', now() at time zone 'Europe/Madrid') at time zone 'Europe/Madrid'
					) as raids_today
				from guilds g
				join guild_protection p on p.guild_id = g.id
				join guild_moderation m on m.guild_id = g.id
				join guild_configuration c on c.guild_id = g.id
				where g.id in ${sql(guildIds)}
			`;
			return new Map(rows.map((r) => [r.id as string, { raidsToday: Number(r.raidsToday), modulesOn: Number(r.modulesOn) }]));
		} catch (error) {
			console.error("[db] no se pudieron calcular las tarjetas:", error instanceof Error ? error.message : error);
			return null;
		}
	}
}

export const overviewRepository = new OverviewRepository();
