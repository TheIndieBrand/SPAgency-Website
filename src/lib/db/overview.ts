import { getSql } from "./client";

// Cifras de la página General. "Hoy" y "ayer" son días de Madrid (igual que el
// reinicio del cupo del asistente), no de UTC; las semanas son 7 días móviles.

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

// Tipos de evento que son una respuesta automática del bot (no una acción pedida).
const AUTO_ACTIONS = ["antibotsKick", "selfbotDetected", "raidmodeJoinBan", "raidmodeActionBan", "raidBotAdderBan", "webhookFloodPurge", "raidDetected"];

export async function getOverview(guildId: string): Promise<Overview | null> {
	try {
		const sql = getSql();
		// Las fechas de la base son UTC sin zona: se pasan a timestamptz para
		// comparar con los límites del día de Madrid.
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

// "+2 vs ayer" / "sin cambios" / "-1 vs semana pasada".
export function deltaText(current: number, previous: number, versus: string): string {
	const diff = current - previous;
	return diff === 0 ? `sin cambios ${versus}` : `${diff > 0 ? "+" : "−"}${Math.abs(diff)} ${versus}`;
}

export { ZERO as EMPTY_OVERVIEW };
