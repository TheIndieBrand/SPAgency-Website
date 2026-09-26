import { RATE_PER_MINUTE } from "./config";

/** per-user, per-minute rate limit shared by chat messages and commands. */
export class ChatRateLimiter {
	/** timestamps per user. */
	private readonly recent = new Map<string, number[]>();

	/**
	 * records one attempt and says whether the user is still within the limit.
	 * @param userId - the discord user id.
	 * @returns true if this attempt is allowed.
	 */
	withinRate(userId: string): boolean {
		const cutoff = Date.now() - 60_000;
		const stamps = (this.recent.get(userId) ?? []).filter((t) => t > cutoff);
		if (stamps.length >= RATE_PER_MINUTE) {
			this.recent.set(userId, stamps);
			return false;
		}
		stamps.push(Date.now());
		this.recent.set(userId, stamps);
		return true;
	}
}

export const chatRateLimiter = new ChatRateLimiter();
