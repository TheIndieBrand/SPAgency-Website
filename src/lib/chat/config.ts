// constants and environment variables for the ai assistant. the limits sit
// together here because they're the lever on token spend: touching one
// changes the cost of every message.

// version of the notice the user accepts before chatting. if the text
// changes (see pages/support/assistant.astro), this version is bumped and
// it's asked again.
export const ConsentVersion = "2026-09-21";

export const MaxInputChars = 1200; // per user message (~300 tokens)
export const MaxOutputTokens = 500; // per response; output is the expensive part
export const HistoryMessages = 8; // previous messages replayed to the model
export const ContextChunks = 3; // site fragments injected per question
export const ContextChars = 1500; // cap on each fragment
export const RatePerMinute = 10; // messages per user per minute
export const ProposalTtlMs = 24 * 60 * 60 * 1000; // how long a ticket proposal lasts

// a settings-change proposal expires sooner than a ticket: the config may have changed.
export const SettingsProposalTtlMs = 60 * 60 * 1000;
export const MaxSettingChanges = 8; // changes per proposal

export const DefaultDailyLimit = 100_000;

export function dailyLimit(): number {
	const value = Number(process.env.CHAT_DAILY_TOKEN_LIMIT);
	return Number.isFinite(value) && value > 0 ? value : DefaultDailyLimit;
}

export function llmSettings() {
	return {
		apiKey: process.env.DEEPSEEK_API_KEY ?? "",
		baseURL: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
		model: process.env.CHAT_MODEL || "deepseek-chat",
	};
}

export function chatConfigured(): boolean {
	return Boolean(process.env.DEEPSEEK_API_KEY);
}
