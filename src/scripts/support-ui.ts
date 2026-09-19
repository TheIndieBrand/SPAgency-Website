// Piezas de interfaz del chat de soporte que comparten la conversación en vivo
// (support-chat.ts) y el transcript. El marcado es el mismo que el de
// src/components/support/SupportMessage.astro: si se toca uno, se toca el otro.

export interface ChatMessage {
	id: string;
	author: "staff" | "user";
	name: string;
	avatar: string | null;
	html: string;
	at: string;
}

export function escapeHtml(text: string): string {
	return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

// `html` ya viene saneado del servidor; el resto (nombre, avatar) se escapa.
export function messageHtml(m: ChatMessage): string {
	const staff = m.author === "staff";
	const initial = escapeHtml((m.name.trim()[0] ?? "?").toUpperCase());
	const avatar = m.avatar
		? `<img src="${escapeHtml(m.avatar)}" alt="" width="36" height="36" class="h-9 w-9 rounded-full object-cover" />`
		: `<div class="bg-bg-soft text-text-dim border-border flex h-9 w-9 items-center justify-center rounded-full border text-sm font-bold">${initial}</div>`;
	const chip = staff
		? `<span class="bg-brand-soft text-brand-hover rounded-full px-2 py-0.5 text-[11px] font-bold">Staff</span>`
		: `<span class="border-border text-text-dim rounded-full border px-2 py-0.5 text-[11px] font-bold">Tú</span>`;

	return `<div class="flex gap-3.5 py-3.5" data-message-id="${escapeHtml(m.id)}">
	<div class="shrink-0">${avatar}</div>
	<div class="min-w-0 flex-1">
		<div class="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
			<span class="text-text text-sm font-bold">${escapeHtml(m.name)}</span>
			${chip}
			<time class="text-text-faint text-xs" datetime="${escapeHtml(m.at)}" data-local>${escapeHtml(m.at)}</time>
		</div>
		<div class="msg-prose mt-1">${m.html}</div>
	</div>
</div>`;
}

// Las fechas llegan en ISO (UTC) y se muestran en la zona horaria de quien mira:
// con fecha y hora, o solo la fecha si el <time> lleva data-local="date".
export function localizeTimes(root: ParentNode = document): void {
	root.querySelectorAll<HTMLTimeElement>("time[data-local]").forEach((el) => {
		const date = new Date(el.dateTime);
		if (Number.isNaN(date.getTime())) return;
		el.textContent =
			el.dataset.local === "date"
				? date.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })
				: date.toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
		el.removeAttribute("data-local");
	});
}
