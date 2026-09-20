// Autoguardado del dashboard. Cada control con `name` guarda su ajuste en cuanto
// cambia (PATCH /api/dashboard/<servidor>/settings); si el servidor lo rechaza, el
// control vuelve al último valor guardado y se avisa del motivo. El servidor es
// quien valida: aquí solo se manda lo que el usuario ha hecho.
//
//   input[type=checkbox][name] / select[name]   → al cambiar
//   input[type=number|text][name]               → al salir del campo (los números, también al dejar de teclear)
//   [data-duration=clave] con un número y una unidad dentro → "15m", "30d"…
//   [data-list=clave] con chips [data-item] y su input/botón de añadir → un elemento cada vez
//   [data-depends=clave] → se deshabilita mientras ese interruptor está apagado
import { escapeHtml, localizeTimes } from "./support-ui";

type SaveResult = { ok: true; data: { value: unknown; activatedAt?: string | null } } | { ok: false; message: string; status: number };

const root = document.getElementById("settings-root");
if (root) init(root);

function init(root: HTMLElement) {
	const endpoint = `/api/dashboard/${encodeURIComponent(root.dataset.guild!)}/settings`;
	localizeTimes(root);

	// ── Aviso de guardado ─────────────────────────────────────────────────────
	const toastEl = document.createElement("div");
	toastEl.setAttribute("role", "status");
	toastEl.setAttribute("aria-live", "polite");
	document.body.append(toastEl);

	const TOAST_BASE =
		"pointer-events-none fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border px-4 py-2 text-[13px] font-semibold shadow-[0_12px_30px_-10px_rgba(0,0,0,0.7)] transition-opacity duration-200";
	const TOAST_STYLES = {
		saving: { classes: "border-border bg-bg-soft text-text-dim", icon: "bi-arrow-repeat" },
		saved: { classes: "border-emerald/40 bg-bg-soft text-emerald", icon: "bi-check-circle-fill" },
		error: { classes: "border-[#ef4444]/50 bg-bg-soft text-[#ef4444]", icon: "bi-exclamation-circle-fill" },
	};
	let toastTimer = 0;
	let toastKind: keyof typeof TOAST_STYLES = "saved";
	toastEl.className = `${TOAST_BASE} ${TOAST_STYLES.saved.classes} opacity-0`;

	function toast(kind: keyof typeof TOAST_STYLES, text: string) {
		window.clearTimeout(toastTimer);
		toastKind = kind;
		toastEl.className = `${TOAST_BASE} ${TOAST_STYLES[kind].classes} opacity-100`;
		toastEl.innerHTML = `<i class="bi ${TOAST_STYLES[kind].icon}"></i><span>${escapeHtml(text)}</span>`;
		// "Guardando…" se queda hasta que llegue la respuesta; lo demás se retira solo.
		if (kind !== "saving") {
			toastTimer = window.setTimeout(
				() => (toastEl.className = `${TOAST_BASE} ${TOAST_STYLES[toastKind].classes} opacity-0`),
				kind === "error" ? 5000 : 1600,
			);
		}
	}

	// ── Envío (uno detrás de otro por ajuste, para que el último cambio gane) ──
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

	// Guarda y avisa; devuelve el resultado para que quien llama actualice o revierta.
	async function commit(key: string, body: Record<string, unknown>, doneText = "Guardado"): Promise<SaveResult> {
		toast("saving", "Guardando…");
		const result = await save(key, body);
		if (result.ok) toast("saved", doneText);
		else toast("error", result.message);
		return result;
	}

	// ── Dependencias (un campo depende de un interruptor) ─────────────────────
	function applyDepends() {
		root!.querySelectorAll<HTMLElement>("[data-depends]").forEach((el) => {
			const toggle = root!.querySelector<HTMLInputElement>(`input[type=checkbox][name="${el.dataset.depends}"]`);
			(el as HTMLInputElement).disabled = toggle ? !toggle.checked : false;
		});
	}
	applyDepends();

	// ── Interruptores y opciones ──────────────────────────────────────────────
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
				// El estado del Modo Pánico se ve también en la barra lateral y en su tarjeta.
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

	// Números y textos: al salir del campo; los números, además al dejar de teclear.
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

	// Duraciones: un número y una unidad que se guardan juntos ("30d").
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

	// ── Listas (lista blanca, razones predefinidas) ───────────────────────────
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
