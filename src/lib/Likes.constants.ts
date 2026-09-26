// limits for the like-toggle rate limiter (see LikesRateLimiter).

/** size of the sliding window used to count toggles, in milliseconds. */
export const WindowMs = 10_000;

/** how many toggles a single user may make within the window. */
export const MaxToggles = 20;

/** stop tracking a user once the map grows past this many entries. */
export const MaxTrackedUsers = 5000;
