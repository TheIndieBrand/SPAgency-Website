export const inputClass =
	"border-border bg-bg-soft text-text placeholder:text-text-faint focus-visible:border-brand w-full min-w-[220px] rounded-lg border px-3 py-2 text-sm outline-none transition-colors sm:w-56";

export const selectClass =
	"border-border bg-bg-soft text-text focus-visible:border-brand w-full min-w-[220px] appearance-none rounded-lg border px-3 py-2 pr-8 text-sm outline-none transition-colors sm:w-56";

export function durationToParts(duration: string): { amount: number; unit: string } {
	const match = /^(\d+)([smhdw])$/.exec(duration);
	if (!match) return { amount: 1, unit: "d" };
	return { amount: Number(match[1]), unit: match[2] };
}
