// dashboard autosave. every control with a `name` saves its setting as soon
// as it changes (PATCH /api/dashboard/<guild>/settings); if the server
// rejects it, the control reverts to its last saved value and the reason is
// shown. the server is what validates: this only sends what the user did.
//
//   input[type=checkbox][name] / select[name]   → on change
//   input[type=number|text][name]               → on blur (numbers also debounce while typing)
//   [data-duration=key] with a number and a unit inside → "15m", "30d"…
//   [data-list=key] with [data-item] chips and its add input/button → one element at a time
//   [data-depends=key] → disabled while that toggle is off
import { escapeHtml, localizeTimes } from "./support-ui";

type SaveResult = { ok: true; data: { value: unknown; activatedAt?: string | null } } | { ok: false; message: string; status: number };

const root = document.getElementById("settings-root");
if (root) init(root);

function init(root: HTMLElement) {
	const endpoint = `/api/dashboard/${encodeURIComponent(root.dataset.guild!)}/settings`;
	localizeTimes(root);

	// ── save toast ────────────────────────────────────────────────────────────
	const toastEl = document.createElement("div");
	toastEl.setAttribute("role", "status");
	toastEl.setAttribute("aria-live", "polite");
	document.body.append(toastEl);

	const ToastBase =
		"pointer-events-none fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border px-4 py-2 text-[13px] font-semibold shadow-[0_12px_30px_-10px_rgba(0,0,0,0.7)] transition-opacity duration-200";
	const ToastStyles = {
		saving: { classes: "border-border bg-bg-soft text-text-dim", icon: "bi-arrow-repeat" },
		saved: { classes: "border-emerald/40 bg-bg-soft text-emerald", icon: "bi-check-circle-fill" },
		error: { classes: "border-[#ef4444]/50 bg-bg-soft text-[#ef4444]", icon: "bi-exclamation-circle-fill" },
	};
	let toastTimer = 0;
	let toastKind: keyof typeof ToastStyles = "saved";
	toastEl.className = `${ToastBase} ${ToastStyles.saved.classes} opacity-0`;

	function toast(kind: keyof typeof ToastStyles, text: string) {
		window.clearTimeout(toastTimer);
		toastKind = kind;
		toastEl.className = `${ToastBase} ${ToastStyles[kind].classes} opacity-100`;
		toastEl.innerHTML = `<i class="bi ${ToastStyles[kind].icon}"></i><span>${escapeHtml(text)}</span>`;
		// "saving…" stays until the response arrives; everything else retreats on its own.
		if (kind !== "saving") {
			toastTimer = window.setTimeout(
				() => (toastEl.className = `${ToastBase} ${ToastStyles[toastKind].classes} opacity-0`),
				kind === "error" ? 5000 : 1600,
			);
		}
	}

	// ── submission (one after another per setting, so the last change wins) ──
	const queues = new Map<string, Promise<unknown>>();

	function save(key: string, body: Record<string, unknown>): Promise<SaveResult> {
		const run = async (): Promise<SaveResult> => {
			try {
				const res = await fetch(endpoint, {
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ key, ...body }),
				});
				const data = await res.json().catch(() => ({}));
				if (res.ok) return { ok: true, data };
				if (res.status === 401) window.setTimeout(() => (window.location.href = "/auth/discord/login?next=" + encodeURIComponent(location.pathname)), 1500);
				return { ok: false, status: res.status, message: data.message ?? "No se pudo guardar." };
			} catch {
				return { ok: false, status: 0, message: "No se pudo conectar. Comprueba tu conexión e inténtalo de nuevo." };
			}
		};
		const next = (queues.get(key) ?? Promise.resolve()).then(run, run);
		queues.set(key, next);
		return next;
	}

	// saves and notifies; returns the result so the caller can update or revert.
	async function commit(key: string, body: Record<string, unknown>, doneText = "Guardado"): Promise<SaveResult> {
		toast("saving", "Guardando…");
		const result = await save(key, body);
		if (result.ok) toast("saved", doneText);
		else toast("error", result.message);
		return result;
	}

	// ── dependencies (a field depends on a toggle) ────────────────────────────
	function applyDepends() {
		root!.querySelectorAll<HTMLElement>("[data-depends]").forEach((el) => {
			const toggle = root!.querySelector<HTMLInputElement>(`input[type=checkbox][name="${el.dataset.depends}"]`);
			(el as HTMLInputElement).disabled = toggle ? !toggle.checked : false;
		});
	}
	applyDepends();

	// ── toggles and options ───────────────────────────────────────────────────
	root.querySelectorAll<HTMLInputElement>("input[type=checkbox][name]").forEach((box) => {
		let saved = box.checked;
		box.addEventListener("change", async () => {
			const wanted = box.checked;
			applyDepends();
			const result = await commit(box.name, { value: wanted });
			if (!result.ok) {
				box.checked = saved;
				applyDepends();
				return;
			}
			saved = Boolean(result.data.value);
			if (box.name === "raidmodeEnable") {
				// panic mode's state also shows in the sidebar and on its card.
				toast("saved", saved ? "Modo Pánico activado" : "Modo Pánico desactivado");
				window.setTimeout(() => window.location.reload(), 700);
			}
		});
	});

	root.querySelectorAll<HTMLSelectElement>("select[name]").forEach((select) => {
		let saved = select.value;
		select.addEventListener("change", async () => {
			const result = await commit(select.name, { value: select.value });
			if (result.ok) saved = String(result.data.value);
			else select.value = saved;
		});
	});

	// numbers and text: on blur; numbers also debounce while typing.
	root.querySelectorAll<HTMLInputElement>("input[type=number][name], input[type=text][name]").forEach((input) => {
		let saved = input.value;
		let timer = 0;

		const submit = async () => {
			window.clearTimeout(timer);
			const value = input.value.trim();
			if (value === saved) return;
			if (input.type === "number" && value === "") {
				input.value = saved;
				return toast("error", "Escribe un número.");
			}
			const result = await commit(input.name, { value: input.type === "number" ? Number(value) : value });
			if (result.ok) {
				saved = result.data.value === null || result.data.value === undefined ? "" : String(result.data.value);
				input.value = saved;
			} else {
				input.value = saved;
			}
		};

		input.addEventListener("change", submit);
		input.addEventListener("keydown", (event) => {
			if (event.key === "Enter") {
				event.preventDefault();
				void submit();
			}
		});
		if (input.type === "number") {
			input.addEventListener("input", () => {
				window.clearTimeout(timer);
				timer = window.setTimeout(submit, 700);
			});
		}
	});

	// durations: a number and a unit saved together ("30d").
	root.querySelectorAll<HTMLElement>("[data-duration]").forEach((box) => {
		const amount = box.querySelector<HTMLInputElement>("input[type=number]")!;
		const unit = box.querySelector<HTMLSelectElement>("select")!;
		const compose = () => `${amount.value.trim()}${unit.value}`;
		let saved = compose();
		let timer = 0;

		const submit = async () => {
			window.clearTimeout(timer);
			if (amount.value.trim() === "") return;
			const wanted = compose();
			if (wanted === saved) return;
			const result = await commit(box.dataset.duration!, { value: wanted });
			if (result.ok) {
				saved = String(result.data.value);
			} else {
				const back = /^(\d+)([smhdw])$/.exec(saved);
				if (back) {
					amount.value = back[1];
					unit.value = back[2];
				}
			}
		};

		amount.addEventListener("change", submit);
		amount.addEventListener("input", () => {
			window.clearTimeout(timer);
			timer = window.setTimeout(submit, 700);
		});
		unit.addEventListener("change", submit);
	});

	// ── lists (whitelist, preset reasons) ─────────────────────────────────────
	function renderList(box: HTMLElement, items: string[]) {
		const icon = box.dataset.icon ? `<i class="bi ${escapeHtml(box.dataset.icon)} text-brand text-[11px]"></i>` : "";
		box.innerHTML = items.length
			? items
					.map(
						(item) => `<span data-item="${escapeHtml(item)}" class="border-border bg-bg-soft text-text-dim inline-flex items-center gap-2 rounded-full border py-1.5 pr-2 pl-3 text-xs font-semibold">
							${icon}${escapeHtml(item)}
							<button type="button" data-remove class="text-text-faint transition-colors hover:text-[#ef4444]" aria-label="Quitar ${escapeHtml(item)}"><i class="bi bi-x-lg text-[10px]"></i></button>
						</span>`,
					)
					.join("")
			: `<p class="text-text-faint text-xs">${escapeHtml(box.dataset.empty ?? "No hay nada todavía.")}</p>`;
	}

	async function changeList(key: string, op: "add" | "remove", value: string): Promise<boolean> {
		const box = root!.querySelector<HTMLElement>(`[data-list="${key}"]`)!;
		const result = await commit(key, { op, value });
		if (!result.ok) return false;
		renderList(box, result.data.value as string[]);
		return true;
	}

	root.addEventListener("click", (event) => {
		const target = event.target as HTMLElement;

		const remove = target.closest<HTMLElement>("[data-remove]");
		if (remove) {
			const box = remove.closest<HTMLElement>("[data-list]")!;
			void changeList(box.dataset.list!, "remove", remove.closest<HTMLElement>("[data-item]")!.dataset.item!);
			return;
		}

		const add = target.closest<HTMLElement>("[data-list-add]");
		if (add) void addFromInput(add.dataset.listAdd!);
	});

	async function addFromInput(key: string) {
		const input = root!.querySelector<HTMLInputElement>(`[data-list-input="${key}"]`)!;
		const value = input.value.trim();
		if (!value) return;
		if (await changeList(key, "add", value)) input.value = "";
	}

	root.querySelectorAll<HTMLInputElement>("[data-list-input]").forEach((input) =>
		input.addEventListener("keydown", (event) => {
			if (event.key === "Enter") {
				event.preventDefault();
				void addFromInput(input.dataset.listInput!);
			}
		}),
	);
}
