// Panel de staff: buscar conversaciones del asistente, leerlas y borrarlas. Las
// rutas comprueban el permiso en el servidor; esto solo es la interfaz.
import { escapeHtml } from "./support-ui";

interface Summary {
	id: string;
	userId: string;
	userName: string;
	title: string;
	updatedAt: string;
	ticketId: string | null;
	messageCount: number;
}

interface View {
	id: number;
	role: "user" | "assistant" | "note";
	html: string;
	at: string;
	units?: number;
	proposal: { subject: string; status: string } | null;
}

const root = document.getElementById("staff-chat");
if (root) init(root);

function init(root: HTMLElement) {
	const q = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
	const search = q<HTMLInputElement>("#search");
	const list = q("#list");
	const listEmpty = q("#list-empty");
	const viewer = q("#viewer");
	const viewerEmpty = q("#viewer-empty");
	const thread = q("#thread");
	const deleteBtn = q<HTMLButtonElement>("#delete");

	let selected: Summary | null = null;
	let items: Summary[] = [];
	let timer: number | undefined;

	const date = (iso: string) =>
		new Date(iso).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

	async function api(url: string, init?: RequestInit) {
		const res = await fetch(url, { headers: { Accept: "application/json", "Content-Type": "application/json" }, ...init });
		const data = await res.json().catch(() => ({}));
		return { ok: res.ok, status: res.status, data };
	}

	async function loadList() {
		const { ok, data } = await api(`/api/chat/staff?q=${encodeURIComponent(search.value.trim())}`);
		if (!ok) return;
		items = data.conversations as Summary[];
		listEmpty.hidden = items.length > 0;
		list.innerHTML = items
			.map(
				(c) => `<li><button type="button" data-id="${escapeHtml(c.id)}" class="${
					c.id === selected?.id ? "bg-brand/10" : "hover:bg-bg-soft"
				} block w-full px-4 py-3 text-left transition-colors">
					<span class="text-text block truncate text-sm font-semibold">${escapeHtml(c.title)}</span>
					<span class="text-text-faint mt-0.5 flex justify-between gap-3 text-[12px]">
						<span class="truncate">${escapeHtml(c.userName)} · ${c.messageCount} msg${c.ticketId ? " · ticket" : ""}</span>
						<span class="shrink-0">${date(c.updatedAt)}</span>
					</span>
				</button></li>`,
			)
			.join("");
	}

	async function open(id: string) {
		const { ok, data } = await api(`/api/chat/staff/${encodeURIComponent(id)}`);
		if (!ok) return void loadList();

		selected = items.find((c) => c.id === id) ?? null;
		const c = data.conversation as { id: string; title: string; userId: string; userName: string; createdAt: string };
		q("#viewer-title").textContent = c.title;
		q("#viewer-meta").textContent = `${c.userName} · ID ${c.userId} · conversación ${c.id} · iniciada ${date(c.createdAt)}`;

		thread.innerHTML = (data.messages as View[])
			.map((m) => {
				const who = { user: "Usuario", assistant: "Asistente (IA)", note: "Sistema" }[m.role];
				const tone = m.role === "user" ? "text-text" : "text-text-dim";
				const units = m.units ? ` · ${Math.round(m.units)} u.` : "";
				const proposal = m.proposal
					? `<p class="text-text-faint mt-1 text-[12px]">Propuesta de ticket «${escapeHtml(m.proposal.subject)}» (${escapeHtml(m.proposal.status)})</p>`
					: "";
				return `<div>
					<div class="text-text-faint mb-1 text-[11.5px] font-bold tracking-[0.06em] uppercase">${who}<span class="font-normal normal-case tracking-normal"> · ${date(m.at)}${units}</span></div>
					<div class="msg-prose ${tone}">${m.html}</div>${proposal}
				</div>`;
			})
			.join("");

		viewerEmpty.hidden = true;
		viewer.hidden = false;
		void loadList();
	}

	list.addEventListener("click", (event) => {
		const item = (event.target as HTMLElement).closest<HTMLElement>("[data-id]");
		if (item) void open(item.dataset.id!);
	});

	search.addEventListener("input", () => {
		window.clearTimeout(timer);
		timer = window.setTimeout(loadList, 250);
	});

	deleteBtn.addEventListener("click", async () => {
		if (!selected) return;
		const label = `«${selected.title}» de ${selected.userName}`;
		if (!window.confirm(`¿Borrar la conversación ${label}?\n\nSe eliminan sus mensajes y propuestas de ticket. No se puede deshacer; el borrado queda registrado con tu ID.`)) return;

		deleteBtn.disabled = true;
		const { ok } = await api(`/api/chat/staff/${encodeURIComponent(selected.id)}`, { method: "DELETE" });
		deleteBtn.disabled = false;
		if (!ok) return window.alert("No se pudo borrar la conversación.");

		selected = null;
		viewer.hidden = true;
		viewerEmpty.hidden = false;
		void loadList();
	});

	void loadList();
}
