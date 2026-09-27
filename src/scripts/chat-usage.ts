// card for the /usage command. the data is computed on the server
// (src/lib/chat/usage.ts); this only renders it.
import { escapeHtml } from "./support-ui";

export interface UsageReport {
	used: number;
	limit: number;
	remaining: number;
	percent: number;
	resetsAt: string;
	requests: number;
	freshTokens: number;
	cachedTokens: number;
	completionTokens: number;
	avgUnitsPerRequest: number | null;
	requestsLeft: number | null;
	week: { day: string; units: number; requests: number }[];
	weights: { input: number; cachedInput: number; output: number };
}

const n = (value: number) => value.toLocaleString("es-ES");

function untilReset(iso: string): string {
	const minutes = Math.max(0, Math.round((Date.parse(iso) - Date.now()) / 60_000));
	const h = Math.floor(minutes / 60);
	const m = minutes % 60;
	return h ? `${h} h ${m} min` : `${m} min`;
}

const row = (label: string, value: string) =>
	`<div class="flex items-baseline justify-between gap-4 py-1.5"><span class="text-text-faint">${label}</span><span class="text-text text-right font-semibold tabular-nums">${value}</span></div>`;

export function usageCardHtml(r: UsageReport): string {
	const warn = r.percent >= 80;
	const maxUnits = Math.max(r.limit, ...r.week.map((d) => d.units));

	const bars = r.week
		.map((d, i) => {
			const today = i === r.week.length - 1;
			const height = Math.max(4, Math.round((d.units / maxUnits) * 100));
			const weekday = new Date(`${d.day}T12:00:00Z`).toLocaleDateString("es-ES", { weekday: "short" }).replace(".", "");
			return `<div class="flex flex-1 flex-col items-center gap-1.5" title="${escapeHtml(`${d.day}: ${n(d.units)} u. en ${d.requests} mensajes`)}">
				<div class="flex h-14 w-full items-end"><div class="${today ? (warn ? "bg-[#f59e0b]" : "bg-brand") : "bg-border"} w-full rounded-sm" style="height:${height}%"></div></div>
				<span class="${today ? "text-text" : "text-text-faint"} text-[11px]">${escapeHtml(weekday)}</span>
			</div>`;
		})
		.join("");

	const pace =
		r.avgUnitsPerRequest !== null && r.requestsLeft !== null
			? row("Media por mensaje", `~${n(r.avgUnitsPerRequest)} u.`) + row("Te quedan aprox.", `${n(r.requestsLeft)} mensajes`)
			: "";

	return `<div class="border-border bg-bg-soft not-prose rounded-xl border p-4" style="color:var(--color-text-dim)">
		<div class="mb-2.5 flex items-baseline justify-between">
			<span class="text-text-faint text-[11px] font-bold tracking-[0.08em] uppercase">Tu consumo de hoy</span>
			<span class="${warn ? "text-[#f59e0b]" : "text-text"} font-display text-2xl font-bold tabular-nums">${r.percent} %</span>
		</div>
		<div class="bg-border mb-3 h-1.5 overflow-hidden rounded-full"><div class="${warn ? "bg-[#f59e0b]" : "bg-brand"} h-full rounded-full" style="width:${r.percent}%"></div></div>
		<div class="divide-border-soft divide-y text-[13px]">
			${row("Usado", `${n(r.used)} / ${n(r.limit)} u.`)}
			${row("Restante", `${n(r.remaining)} u.`)}
			${row("Mensajes hoy", n(r.requests))}
			${pace}
			${row("Se restablece", `en ${untilReset(r.resetsAt)} <span class="text-text-faint font-normal">(medianoche, hora de Madrid)</span>`)}
		</div>
		<div class="text-text-faint mt-3 grid grid-cols-3 gap-2 text-center text-[12px]">
			<div><div class="text-text text-sm font-semibold tabular-nums">${n(r.freshTokens)}</div>entrada nueva</div>
			<div><div class="text-text text-sm font-semibold tabular-nums">${n(r.cachedTokens)}</div>entrada en caché</div>
			<div><div class="text-text text-sm font-semibold tabular-nums">${n(r.completionTokens)}</div>salida</div>
		</div>
		<div class="border-border-soft mt-4 border-t pt-3.5">
			<div class="text-text-faint mb-2 text-[11px] font-bold tracking-[0.08em] uppercase">Últimos 7 días</div>
			<div class="flex gap-1.5">${bars}</div>
		</div>
		<p class="text-text-faint mt-3 text-[11.5px] leading-snug">Las unidades (u.) ponderan cada token por lo que cuesta: entrada nueva ×${r.weights.input}, en caché ×${String(r.weights.cachedInput).replace(".", ",")}, salida ×${r.weights.output}.</p>
	</div>`;
}
