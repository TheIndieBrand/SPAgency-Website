import OpenAI from "openai";
import { MaxOutputTokens, llmSettings } from "./config";
import { SETTINGS_TOOL, TICKET_TOOL, TICKET_TOOL_NAME, ticketDraftMessages, type ChatMessage } from "./prompt";
import { parseTicketDraft, type TicketDraft } from "./ticket";
import { estimateUsage, type TokenUsage } from "./usage";

// DeepSeek habla el protocolo de OpenAI: basta apuntar el SDK a su base URL.
// Con DEEPSEEK_BASE_URL se puede cambiar de proveedor (o probar contra un
// servidor local) sin tocar código.

let client: OpenAI | null = null;
let clientKey = "";

function getClient(): OpenAI {
	const { apiKey, baseURL } = llmSettings();
	const key = `${apiKey}|${baseURL}`;
	if (!client || clientKey !== key) {
		client = new OpenAI({ apiKey, baseURL, timeout: 60_000, maxRetries: 1 });
		clientKey = key;
	}
	return client;
}

export interface ToolCall {
	name: string;
	arguments: string;
}

export type LlmEvent =
	| { type: "text"; delta: string }
	| { type: "done"; usage: TokenUsage | null; toolCall: ToolCall | null };

// Extensión de DeepSeek al objeto de uso estándar: cuántos tokens de entrada
// salieron de su caché de prefijo.
interface DeepSeekUsage extends OpenAI.CompletionUsage {
	prompt_cache_hit_tokens?: number;
}

export async function* streamCompletion(messages: ChatMessage[], signal: AbortSignal): AsyncGenerator<LlmEvent> {
	const stream = await getClient().chat.completions.create(
		{
			model: llmSettings().model,
			messages,
			stream: true,
			stream_options: { include_usage: true },
			max_tokens: MaxOutputTokens,
			temperature: 0.3,
			tools: [TICKET_TOOL, SETTINGS_TOOL],
		},
		{ signal },
	);

	let usage: TokenUsage | null = null;
	let toolName = "";
	let toolArgs = "";

	for await (const chunk of stream) {
		const delta = chunk.choices[0]?.delta;
		if (delta?.content) yield { type: "text", delta: delta.content };

		// Las llamadas a herramientas llegan troceadas: el nombre en el primer
		// fragmento y los argumentos (JSON) repartidos en los siguientes.
		// Solo se atiende la primera llamada (índice 0): mezclar los argumentos de
		// varias daría un JSON roto.
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

// Redacta el ticket del comando /ticket. Una sola llamada, sin streaming, con la
// herramienta forzada: el resultado es siempre asunto + resumen (o nada si el
// modelo devolvió algo inservible; el gasto se cobra igualmente).
export async function draftTicket(
	history: { role: "user" | "assistant"; content: string }[],
	note: string,
	signal: AbortSignal,
): Promise<{ draft: TicketDraft | null; usage: TokenUsage }> {
	const messages = ticketDraftMessages(history, note);
	const response = await getClient().chat.completions.create(
		{
			model: llmSettings().model,
			messages,
			max_tokens: 400,
			temperature: 0.2,
			tools: [TICKET_TOOL],
			tool_choice: { type: "function", function: { name: TICKET_TOOL_NAME } },
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
