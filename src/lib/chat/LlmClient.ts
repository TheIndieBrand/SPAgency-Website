import OpenAI from "openai";
import { MaxOutputTokens, llmSettings } from "./config";
import { SettingsTool, TicketTool, TicketToolName, ticketDraftMessages, type ChatMessage } from "./prompt";
import { parseTicketDraft, type TicketDraft } from "./ticket";
import { estimateUsage, type TokenUsage } from "./usage";

// deepseek speaks the openai protocol: pointing the sdk at its base url is
// enough. DEEPSEEK_BASE_URL can switch providers (or test against a local
// server) without touching code.

export interface ToolCall {
	name: string;
	arguments: string;
}

export type LlmEvent = { type: "text"; delta: string } | { type: "done"; usage: TokenUsage | null; toolCall: ToolCall | null };

// deepseek's extension to the standard usage object: how many input tokens
// came from its prefix cache.
interface DeepSeekUsage extends OpenAI.CompletionUsage {
	prompt_cache_hit_tokens?: number;
}

/** the assistant's client for the underlying language model. */
export class LlmClient {
	private client: OpenAI | null = null;
	private clientKey = "";

	private getClient(): OpenAI {
		const { apiKey, baseURL } = llmSettings();
		const key = `${apiKey}|${baseURL}`;
		if (!this.client || this.clientKey !== key) {
			this.client = new OpenAI({ apiKey, baseURL, timeout: 60_000, maxRetries: 1 });
			this.clientKey = key;
		}
		return this.client;
	}

	async *streamCompletion(messages: ChatMessage[], signal: AbortSignal): AsyncGenerator<LlmEvent> {
		const stream = await this.getClient().chat.completions.create(
			{
				model: llmSettings().model,
				messages,
				stream: true,
				stream_options: { include_usage: true },
				max_tokens: MaxOutputTokens,
				temperature: 0.3,
				tools: [TicketTool, SettingsTool],
			},
			{ signal },
		);

		let usage: TokenUsage | null = null;
		let toolName = "";
		let toolArgs = "";

		for await (const chunk of stream) {
			const delta = chunk.choices[0]?.delta;
			if (delta?.content) yield { type: "text", delta: delta.content };

			// tool calls arrive chunked: the name in the first fragment and the
			// arguments (json) spread across the following ones. only the first
			// call (index 0) is handled: mixing arguments from several would
			// produce broken json.
			for (const call of delta?.tool_calls ?? []) {
				if ((call.index ?? 0) !== 0) continue;
				if (call.function?.name) toolName = call.function.name;
				if (call.function?.arguments) toolArgs += call.function.arguments;
			}

			if (chunk.usage) {
				const u = chunk.usage as DeepSeekUsage;
				usage = {
					promptTokens: u.prompt_tokens ?? 0,
					cachedTokens: u.prompt_cache_hit_tokens ?? u.prompt_tokens_details?.cached_tokens ?? 0,
					completionTokens: u.completion_tokens ?? 0,
				};
			}
		}

		yield { type: "done", usage, toolCall: toolName ? { name: toolName, arguments: toolArgs } : null };
	}

	/**
	 * drafts the ticket for the /ticket command. a single, non-streaming call
	 * with the tool forced: the result is always a subject + summary (or
	 * nothing if the model returned junk; the cost is charged either way).
	 */
	async draftTicket(
		history: { role: "user" | "assistant"; content: string }[],
		note: string,
		signal: AbortSignal,
	): Promise<{ draft: TicketDraft | null; usage: TokenUsage }> {
		const messages = ticketDraftMessages(history, note);
		const response = await this.getClient().chat.completions.create(
			{
				model: llmSettings().model,
				messages,
				max_tokens: 400,
				temperature: 0.2,
				tools: [TicketTool],
				tool_choice: { type: "function", function: { name: TicketToolName } },
			},
			{ signal },
		);

		const message = response.choices[0]?.message;
		const args = message?.tool_calls?.find((c) => c.type === "function")?.function.arguments ?? message?.content ?? "";

		const u = response.usage as DeepSeekUsage | undefined;
		const usage: TokenUsage = u
			? {
					promptTokens: u.prompt_tokens ?? 0,
					cachedTokens: u.prompt_cache_hit_tokens ?? u.prompt_tokens_details?.cached_tokens ?? 0,
					completionTokens: u.completion_tokens ?? 0,
				}
			: estimateUsage(
					messages.reduce((sum, m) => sum + (typeof m.content === "string" ? m.content.length : 0), 0),
					args.length,
				);

		return { draft: parseTicketDraft(args), usage };
	}
}

export const llmClient = new LlmClient();
