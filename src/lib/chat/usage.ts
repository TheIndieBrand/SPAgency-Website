import { dailyLimit } from "./config";
import { addUsage, getUsage, getUsageDays } from "./db";

// El límite diario se mide en "unidades" ponderadas por lo que cuesta cada tipo
// de token en el proveedor, no en tokens brutos: si no, el contexto cacheado
// (que casi sale gratis) se comería el cupo igual que la salida (que es lo caro).
// Con estos pesos, 100.000 unidades son unas decenas de conversaciones al día.
export const WEIGHTS = { input: 1, cachedInput: 0.1, output: 4 };

export interface TokenUsage {
	promptTokens: number;
	cachedTokens: number;
	completionTokens: number;
}

export function weighted(usage: TokenUsage): number {
	const fresh = Math.max(0, usage.promptTokens - usage.cachedTokens);
	return Math.round(
		fresh * WEIGHTS.input + usage.cachedTokens * WEIGHTS.cachedInput + usage.completionTokens * WEIGHTS.output,
	);
}

// Cuando no llega el uso real (corte de conexión, cancelación) se estima por
// longitud: ~3,5 caracteres por token en español. Sesgado al alza a propósito.
export function estimateUsage(promptChars: number, completionChars: number): TokenUsage {
	return {
		promptTokens: Math.ceil(promptChars / 3.5),
		cachedTokens: 0,
		completionTokens: Math.ceil(completionChars / 3.5),
	};
}

// El día cambia a medianoche de Madrid, que es cuando esperan el reinicio los
// usuarios de la web.
const TIME_ZONE = "Europe/Madrid";

export function usageDay(now = new Date()): string {
	return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(now);
}

function msUntilReset(now = new Date()): number {
	const parts = new Intl.DateTimeFormat("en-GB", {
		timeZone: TIME_ZONE,
		hour: "numeric",
		minute: "numeric",
		second: "numeric",
		hourCycle: "h23",
	}).formatToParts(now);
	const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
	return 86_400_000 - (get("hour") * 3600 + get("minute") * 60 + get("second")) * 1000;
}

export interface UsageState {
	used: number;
	limit: number;
	remaining: number;
	resetsAt: string;
}

export function usageState(userId: string): UsageState {
	const limit = dailyLimit();
	const used = getUsage(userId, usageDay());
	return {
		used,
		limit,
		remaining: Math.max(0, limit - used),
		resetsAt: new Date(Date.now() + msUntilReset()).toISOString(),
	};
}

// Anota el gasto de una llamada al modelo y devuelve las unidades que costó.
export function recordUsage(userId: string, usage: TokenUsage): number {
	const units = weighted(usage);
	addUsage(userId, usageDay(), { units, ...usage });
	return units;
}

// Detalle para el comando /usage del chat.
export interface UsageReport extends UsageState {
	percent: number;
	requests: number;
	freshTokens: number;
	cachedTokens: number;
	completionTokens: number;
	avgUnitsPerRequest: number | null;
	requestsLeft: number | null;
	week: { day: string; units: number; requests: number }[];
	weights: typeof WEIGHTS;
}

function lastDays(count: number): string[] {
	const noon = new Date(`${usageDay()}T12:00:00Z`).getTime();
	return Array.from({ length: count }, (_, i) => new Date(noon - (count - 1 - i) * 86_400_000).toISOString().slice(0, 10));
}

export function usageReport(userId: string): UsageReport {
	const state = usageState(userId);
	const days = lastDays(7);
	const rows = new Map(getUsageDays(userId, days).map((r) => [r.day, r]));
	const today = rows.get(days[6]);

	const requests = today?.requests ?? 0;
	const avg = requests > 0 ? state.used / requests : null;

	return {
		...state,
		percent: Math.min(100, Math.round((state.used / state.limit) * 100)),
		requests,
		freshTokens: Math.max(0, (today?.promptTokens ?? 0) - (today?.cachedTokens ?? 0)),
		cachedTokens: today?.cachedTokens ?? 0,
		completionTokens: today?.completionTokens ?? 0,
		avgUnitsPerRequest: avg === null ? null : Math.round(avg),
		requestsLeft: avg ? Math.floor(state.remaining / avg) : null,
		week: days.map((day) => ({ day, units: Math.round(rows.get(day)?.units ?? 0), requests: rows.get(day)?.requests ?? 0 })),
		weights: WEIGHTS,
	};
}
