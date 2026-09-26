import { MaxToggles, MaxTrackedUsers, WindowMs } from "./Likes.constants";

/**
 * anti-abuse throttle for toggling likes: at most `MaxToggles` per user
 * inside a sliding window of `WindowMs`, tracked in memory.
 */
export class LikesRateLimiter {
	private readonly recent = new Map<string, number[]>();

	/**
	 * records one toggle attempt and says whether the user is over the limit.
	 * @param userId - the discord user id toggling a like.
	 * @returns true if this attempt should be rejected.
	 */
	isRateLimited(userId: string): boolean {
		const now = Date.now();
		const hits = (this.recent.get(userId) ?? []).filter((t) => now - t < WindowMs);
		hits.push(now);
		this.recent.set(userId, hits);

		// sin acumular usuarios inactivos para siempre.
		if (this.recent.size > MaxTrackedUsers) {
			for (const [id, times] of this.recent) if (now - times[times.length - 1] > WindowMs) this.recent.delete(id);
		}

		return hits.length > MaxToggles;
	}
}

export const likesRateLimiter = new LikesRateLimiter();
