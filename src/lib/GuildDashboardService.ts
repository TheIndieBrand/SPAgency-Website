import { botInviteUrl, getBotGuildIds, getUserGuilds, guildIconUrl, hasAdminAccess } from "./discord";
import { MODULES_TOTAL, overviewRepository, type GuildCardStats } from "./db/OverviewRepository";

export interface GuildCard {
	id: string;
	name: string;
	icon: string | null;
	members: number | null;
	protected: boolean;
	inviteUrl: string | null;
	stats: (GuildCardStats & { modulesTotal: number }) | null;
}

export type GuildCardsResult = { ok: true; guilds: GuildCard[] } | { ok: false; reason: "unauthorized" | "unavailable" };

/**
 * builds the guild list shown on the dashboard's home page: which servers the
 * user administers, whether the bot is in each one, and its protection stats.
 */
export class GuildDashboardService {
	/**
	 * lists the guilds a discord user can manage, with the bot's stats merged in.
	 * @param accessToken - the user's discord access token.
	 * @returns the guild cards, or why they could not be built.
	 */
	async listGuildCards(accessToken: string): Promise<GuildCardsResult> {
		try {
			const [userGuilds, botGuildIds] = await Promise.all([getUserGuilds(accessToken), getBotGuildIds()]);

			// discord rejected the token: the session is no longer valid.
			if (!userGuilds) return { ok: false, reason: "unauthorized" };

			const admin = userGuilds.filter(hasAdminAccess);
			// card numbers: one query for every guild with the bot. if the database
			// doesn't respond, the cards are left without numbers (never made up).
			const stats = await overviewRepository.getGuildCardStats(admin.filter((g) => botGuildIds.has(g.id)).map((g) => g.id));

			const guilds = admin
				.map((guild) => {
					const isProtected = botGuildIds.has(guild.id);
					const own = stats?.get(guild.id);
					return {
						id: guild.id,
						name: guild.name,
						icon: guildIconUrl(guild),
						members: guild.approximate_member_count ?? null,
						protected: isProtected,
						inviteUrl: isProtected ? null : botInviteUrl(guild.id),
						stats: own ? { ...own, modulesTotal: MODULES_TOTAL } : null,
					};
				})
				.sort((a, b) => a.name.localeCompare(b.name));

			return { ok: true, guilds };
		} catch {
			// discord isn't responding: not a session problem, safe to retry.
			return { ok: false, reason: "unavailable" };
		}
	}
}

export const guildDashboardService = new GuildDashboardService();
