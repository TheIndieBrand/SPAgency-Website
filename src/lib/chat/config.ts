// Constantes y variables de entorno del asistente de IA. Los límites están aquí
// juntos porque son la palanca del gasto de tokens: tocar uno cambia el coste
// de cada mensaje.

// Versión del aviso que el usuario acepta antes de chatear. Si cambia el texto
// (ver pages/support/assistant.astro), se sube esta versión y se le vuelve
// a pedir.
export const CONSENT_VERSION = "2026-09-21";

export const MAX_INPUT_CHARS = 1200; // por mensaje del usuario (~300 tokens)
export const MAX_OUTPUT_TOKENS = 500; // por respuesta; la salida es lo más caro
export const HISTORY_MESSAGES = 8; // mensajes previos que se reenvían al modelo
export const CONTEXT_CHUNKS = 3; // fragmentos de la web que se inyectan por pregunta
export const CONTEXT_CHARS = 1500; // tope de cada fragmento
export const RATE_PER_MINUTE = 10; // mensajes por usuario y minuto
export const PROPOSAL_TTL_MS = 24 * 60 * 60 * 1000; // caducidad de una propuesta de ticket

// Una propuesta de cambios caduca antes que un ticket: la configuración puede haber cambiado.
export const SETTINGS_PROPOSAL_TTL_MS = 60 * 60 * 1000;
export const MAX_SETTING_CHANGES = 8; // cambios por propuesta

export const DEFAULT_DAILY_LIMIT = 100_000;

export function dailyLimit(): number {
	const value = Number(process.env.CHAT_DAILY_TOKEN_LIMIT);
	return Number.isFinite(value) && value > 0 ? value : DEFAULT_DAILY_LIMIT;
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
