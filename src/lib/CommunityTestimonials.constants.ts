// limits for community testimonial comments (see CommunityTestimonialsRepository).

/** minimum length of a submitted comment. */
export const MinCommentLength = 20;

/** maximum length of a submitted comment. */
export const MaxCommentLength = 400;

/** minimum time between two submissions from the same user, in milliseconds. */
export const SubmissionCooldownMs = 60_000;

/** maximum submissions a user may make in a rolling 24-hour window. */
export const DailySubmissionLimit = 3;
