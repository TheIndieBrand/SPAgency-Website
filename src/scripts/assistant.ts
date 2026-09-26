// assistant ui: conversations, the consent notice, sending with a streamed
// response (sse over fetch, since sending is a post) and the ticket
// proposal card. messages' html is built and sanitized by the server; this only renders it.
import { decorateRoutes, type Routes } from "./chat-links";
import { usageCardHtml } from "./chat-usage";
import { escapeHtml, localizeTimes } from "./support-ui";

interface Usage {
	used: number;
	limit: number;
	remaining: number;
}

interface Proposal {
	id: string;
	kind?: "ticket" | "settings";
	// only on settings changes: the guild they'd be applied to.
	guild?: string | null;
	subject: string;
	summary: string;
	status: "pending" | "confirmed" | "dismissed" | "expired";
	ticketId: string | null;
}

interface MessageView {
	id: number;
	role: "user" | "assistant" | "note";
	html: string;
	at: string;
	proposal: Proposal | null;
}

interface State {
	configured: boolean;
	consented: boolean;
	maxInputChars: number;
	usage: Usage;
	staff: boolean;
	routes: Routes;
	conversations: { id: string; title: string; updatedAt: string; ticketId: string | null }[];
}

const root = document.getElementById("assistant");
if (root) void init(root);

async function init(root: HTMLElement) {
	const q = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
	const messagesEl = q("#messages");
	const emptyEl = q("#empty");
	const consentEl = q("#consent");
	const unavailableEl = q("#unavailable");
	const composerWrap = q("#composer-wrap");
	const form = q<HTMLFormElement>("#composer");
	const input = form.querySelector("textarea")!;
	const sendBtn = q<HTMLButtonElement>("#send");
	const statusEl = q("#status");
	const listEl = root.querySelector<HTMLElement>("#conversations");

	let state: State | null = null;
	let conversationId: string | null = null;
	let controller: AbortController | null = null;
	let busy = false;
	let routes: Routes = {};
	let chosenGuild = false; // el último /servidor se resolvió bien

	// Las rutas de la web que cita el asistente se convierten en botones.
	const decorate = (el: Element | null) => {
		if (el) decorateRoutes(el, routes);
	};

	const setStatus = (text: string) => (statusEl.textContent = text);

	// the guild the conversation acts on, always visible.
	let guildName: string | null = null;
	const guildChip = root.querySelector<HTMLElement>("#guild-chip");
	function setGuild(name: string | null | undefined) {
		guildName = name ?? null;
		if (!guildChip) return;
		guildChip.hidden = !guildName;
		const label = guildChip.querySelector("#guild-name");
		if (label) label.textContent = guildName ?? "";
	}
	const login = () => (window.location.href = `/auth/discord/login?next=${encodeURIComponent("/support/assistant")}`);

	// ── Uso diario ─────────────────────────────────────────────────────────────
	function setUsage(usage: Usage) {
		const pct = Math.min(100, Math.round((usage.used / usage.limit) * 100));
		q("#usage").classList.remove("hidden");
		q("#usage").classList.add("flex");
		q("#usage-bar").style.width = `${pct}%`;
		q("#usage-bar").classList.toggle("bg-[#f59e0b]", pct >= 80);
		q("#usage-bar").classList.toggle("bg-brand", pct < 80);
		q("#usage-label").textContent = `${pct} %`;
		if (usage.remaining <= 0) setStatus("Has llegado al límite de hoy. Se restablece a medianoche (hora de Madrid).");
	}

	// ── Pintado ────────────────────────────────────────────────────────────────
	const userBubble = (html: string) =>
		`<div class="flex justify-end"><div class="msg-prose max-w-[88%] rounded-2xl rounded-br-md border border-brand/30 bg-brand/10 px-4 py-2.5" style="color:var(--color-text)">${html}</div></div>`;

	const assistantBubble = (html: string) =>
		`<div class="flex gap-3" data-assistant>
			<span class="bg-brand-soft text-brand-hover mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px]"><i class="bi bi-stars"></i></span>
			<div class="min-w-0 flex-1"><div class="msg-prose" data-body>${html}</div><div data-extras></div></div>
		</div>`;

	const noteBubble = (html: string) =>
		`<div class="text-text-faint msg-prose mx-auto max-w-[90%] rounded-lg border border-border-soft px-3.5 py-2 text-center text-[13px]">${html}</div>`;

	function proposalCard(p: Proposal): string {
		const settings = p.kind === "settings";
		const where = settings && p.guild ? escapeHtml(p.guild) : "";
		const head = `<div class="text-text-faint mb-1.5 text-[11px] font-bold tracking-[0.08em] uppercase">${settings ? "Cambios propuestos" : "Propuesta de ticket"}</div>
			${where ? `<div class="text-brand mb-1.5 text-[13px] font-bold"><i class="bi bi-hdd-network mr-1"></i>Servidor: ${where}</div>` : ""}
			<div data-subject class="text-text text-sm font-bold">${escapeHtml(p.subject)}</div>
			<p data-summary class="text-text-dim mt-1 text-[13px] leading-relaxed whitespace-pre-line">${escapeHtml(p.summary)}</p>`;

		let foot: string;
		if (p.status === "confirmed" && settings) {
			foot = `<p class="text-text-faint mt-3 text-[13px]"><i class="bi bi-check2-circle"></i> Confirmados${where ? ` en ${where}` : ""} (el resultado está debajo).</p>`;
		} else if (p.status === "confirmed" && p.ticketId) {
			foot = `<a href="/support/tickets/${encodeURIComponent(p.ticketId)}" target="_blank" rel="noopener" class="route-chip mt-3"><i class="bi bi-ticket-perforated"></i><span>Ir al ticket</span><i class="bi bi-box-arrow-up-right"></i></a>`;
		} else if (p.status === "dismissed") {
			foot = `<p class="text-text-faint mt-3 text-[13px]">Descartada.</p>`;
		} else if (p.status === "expired") {
			foot = `<p class="text-text-faint mt-3 text-[13px]">Esta propuesta ha caducado. Pídeme que la prepare de nuevo.</p>`;
		} else {
			const note = settings
				? `Se aplican${where ? ` en <strong>${where}</strong>` : " a tu servidor"} en cuanto confirmes, y puedes revertirlos desde el dashboard.`
				: "El primer mensaje del ticket lo escribirá la IA con este resumen, y así se indicará.";
			foot = `<p class="text-text-faint mt-2.5 text-[12px] leading-snug"><i class="bi bi-stars"></i> ${note}</p>
				<div class="mt-3 flex gap-2">
					<button type="button" data-act="confirm" class="bg-brand hover:bg-brand-hover rounded-lg px-4 py-2 text-[13px] font-bold text-white transition-colors disabled:opacity-50">${settings ? (where ? `Aplicar en ${where}` : "Aplicar cambios") : "Abrir ticket"}</button>
					<button type="button" data-act="dismiss" class="border-border text-text-dim hover:text-text rounded-lg border px-4 py-2 text-[13px] font-bold transition-colors disabled:opacity-50">Ahora no</button>
				</div>
				<p data-proposal-status class="mt-2 min-h-4 text-[12.5px] text-red-400"></p>`;
		}
		return `<div class="border-border bg-bg-soft mt-3 rounded-xl border p-4" data-proposal="${escapeHtml(p.id)}" data-kind="${settings ? "settings" : "ticket"}" data-guild="${escapeHtml(p.guild ?? "")}">${head}${foot}</div>`;
	}

	// one button per guild. `retry` is the request the user had just made: it
	// repeats as soon as they choose, so they don't have to type it again.
	function serverChips(guilds: { id: string; name: string; current?: boolean }[], retry?: string): string {
		return `<div class="mt-3 flex flex-wrap gap-2" ${retry ? `data-retry="${escapeHtml(retry)}"` : ""}>${guilds
			.map(
				(g) =>
					`<button type="button" data-server="${escapeHtml(g.id)}" class="${g.current ? "border-brand text-brand" : "border-border text-text-dim hover:text-text"} rounded-lg border px-3.5 py-1.5 text-[13px] font-semibold transition-colors">${escapeHtml(g.name)}</button>`,
			)
			.join("")}</div>`;
	}

	function showMessage(m: MessageView) {
		if (m.role === "user") messagesEl.insertAdjacentHTML("beforeend", userBubble(m.html));
		else if (m.role === "note") {
			messagesEl.insertAdjacentHTML("beforeend", noteBubble(m.html));
			decorate(messagesEl.lastElementChild);
		} else {
			messagesEl.insertAdjacentHTML("beforeend", assistantBubble(m.html));
			decorate(messagesEl.lastElementChild);
			if (m.proposal) messagesEl.lastElementChild!.querySelector("[data-extras]")!.innerHTML = proposalCard(m.proposal);
		}
	}

	const scrollDown = () => (messagesEl.scrollTop = messagesEl.scrollHeight);
	const nearBottom = () => messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight < 90;

	function resetMessages() {
		messagesEl.querySelectorAll(":scope > :not(#empty)").forEach((el) => el.remove());
	}

	// ── Conversaciones ─────────────────────────────────────────────────────────
	function renderList() {
		if (!listEl || !state) return;
		listEl.innerHTML = state.conversations.length
			? state.conversations
					.map(
						(c) => `<li><button type="button" data-conversation="${escapeHtml(c.id)}" class="${
							c.id === conversationId ? "bg-brand/10 text-brand" : "text-text-dim hover:bg-bg-soft hover:text-text"
						} flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] font-semibold transition-colors">
							<span class="min-w-0 flex-1 truncate">${escapeHtml(c.title)}</span>${c.ticketId ? '<i class="bi bi-ticket-perforated text-text-faint shrink-0 text-xs" title="Con ticket"></i>' : ""}
						</button></li>`,
					)
					.join("")
			: `<li class="text-text-faint px-2.5 py-2 text-[13px]">Aún no hay conversaciones.</li>`;
	}

	async function fetchState(): Promise<State | null> {
		const res = await fetch("/api/chat/state", { headers: { Accept: "application/json" } }).catch(() => null);
		if (!res) return null;
		if (res.status === 401) {
			login();
			return null;
		}
		return res.ok ? ((await res.json()) as State) : null;
	}

	async function openConversation(id: string) {
		if (busy) return;
		const res = await fetch(`/api/chat/conversations/${encodeURIComponent(id)}`, { headers: { Accept: "application/json" } });
		if (!res.ok) return setStatus("No se pudo abrir la conversación.");
		const data = (await res.json()) as { id: string; messages: MessageView[]; guild?: { name: string } | null };

		conversationId = data.id;
		setGuild(data.guild?.name);
		resetMessages();
		emptyEl.hidden = true;
		data.messages.forEach(showMessage);
		renderList();
		setStatus("");
		scrollDown();
	}

	function newConversation() {
		if (busy) return;
		conversationId = null;
		setGuild(null);
		resetMessages();
		emptyEl.hidden = false;
		renderList();
		setStatus("");
		input.focus();
	}

	// ── sending and streaming ───────────────────────────────────────────────────
	function setBusy(value: boolean) {
		busy = value;
		sendBtn.innerHTML = value ? '<i class="bi bi-stop-fill"></i>' : '<i class="bi bi-arrow-up"></i>';
		sendBtn.setAttribute("aria-label", value ? "Detener" : "Enviar");
		sendBtn.type = value ? "button" : "submit";
	}

	async function send(text: string) {
		if (busy || !text.trim()) return;
		const command = /^\/(usage|ticket|servidor|config|panico|registros)(?:\s+([\s\S]*))?$/i.exec(text.trim());
		if (command) return runCommand(command[1].toLowerCase() as CommandName, (command[2] ?? "").trim(), text.trim());
		setStatus("");
		controller = new AbortController();

		let res: Response;
		try {
			res = await fetch("/api/chat", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ message: text, conversationId }),
				signal: controller.signal,
			});
		} catch {
			return setStatus("No se pudo conectar. Inténtalo de nuevo.");
		}

		if (!res.ok) {
			const data = await res.json().catch(() => ({}));
			if (res.status === 401) return login();
			if (data.error === "consent_required") return showConsent();
			if (data.usage) setUsage(data.usage);
			return setStatus(data.message ?? "No se pudo enviar el mensaje.");
		}

		input.value = "";
		autosize();
		emptyEl.hidden = true;
		setBusy(true);

		messagesEl.insertAdjacentHTML("beforeend", userBubble(escapeHtml(text).replace(/\n/g, "<br>")));
		messagesEl.insertAdjacentHTML("beforeend", assistantBubble('<span class="animate-status-pulse text-text-faint">…</span>'));
		const bubble = messagesEl.lastElementChild as HTMLElement;
		const body = bubble.querySelector<HTMLElement>("[data-body]")!;
		const extras = bubble.querySelector<HTMLElement>("[data-extras]")!;
		scrollDown();

		try {
			await readEvents(res, (event, data) => {
				const stick = nearBottom();
				if (event === "meta") conversationId = data.conversationId;
				else if (event === "guild") setGuild(data.name);
				else if (event === "servers") extras.innerHTML = serverChips(data.guilds, data.retry);
				else if (event === "html") {
					body.innerHTML = data.html;
					decorate(body);
				}
				else if (event === "proposal") extras.innerHTML = proposalCard({ ...data, status: "pending", ticketId: null });
				else if (event === "done") setUsage(data.usage);
				else if (event === "error") body.innerHTML = `<p class="text-red-400">${escapeHtml(data.message)}</p>`;
				if (stick) scrollDown();
			});
		} catch {
			// Cortado por el usuario (Detener) o por la red: lo recibido se queda.
		} finally {
			setBusy(false);
			controller = null;
		}

		const fresh = await fetchState();
		if (fresh) {
			state = fresh;
			renderList();
			setUsage(fresh.usage);
		}
		input.focus();
	}

	// ── Comandos ───────────────────────────────────────────────────────────────
	// resolved on the server. only /ticket calls the model (one call to draft
	// the ticket) and counts against the quota; the rest cost nothing.
	type CommandName = "usage" | "ticket" | "servidor" | "config" | "panico" | "registros";
	// like discord's slash commands: each command declares its parameters
	// (name, whether required, what they ask for and, if any, suggested values).
	interface Param {
		name: string;
		required: boolean;
		desc: string;
		choices?: string[];
	}
	const Commands: { name: string; desc: string; params: Param[] }[] = [
		{
			name: "/servidor",
			desc: "Elige el servidor sobre el que actúo",
			params: [{ name: "servidor", required: false, desc: "Nombre, número o ID. Sin él te muestro tus servidores para elegir." }],
		},
		{
			name: "/config",
			desc: "Ajustes actuales de tu servidor",
			params: [{ name: "sección", required: false, desc: "Qué parte ver. Sin ella, todas.", choices: ["protección", "automoderación", "alertas", "general"] }],
		},
		{
			name: "/panico",
			desc: "Propone activar o apagar el Modo Pánico",
			params: [{ name: "estado", required: false, desc: "Sin él, propongo lo contrario del estado actual.", choices: ["on", "off"] }],
		},
		{ name: "/registros", desc: "Últimos eventos del servidor", params: [] },
		{ name: "/usage", desc: "Tu consumo de hoy, con detalle", params: [] },
		{
			name: "/ticket",
			desc: "Prepara un ticket con lo que hemos hablado",
			params: [{ name: "descripción", required: false, desc: "Qué necesitas. Sin ella uso la conversación." }],
		},
	];

	const menu = root.querySelector<HTMLElement>("#cmd-menu");

	function hideMenu() {
		if (menu) menu.hidden = true;
	}

	// a parameter is drawn like on discord: a box with its name. dashed if
	// optional, brand-colored if required, and filled once it has a value.
	function paramBox(p: Param, value = ""): string {
		const tone = value
			? "border-brand bg-brand/10 text-text"
			: p.required
				? "border-brand/60 text-brand"
				: "border-dashed border-border text-text-dim";
		return `<span class="${tone} inline-flex max-w-full items-center gap-1.5 rounded-md border px-2 py-0.5 font-sans text-[12.5px]"><span class="font-semibold">${escapeHtml(p.name)}</span>${
			value ? `<span class="text-text truncate font-mono">${escapeHtml(value.slice(0, 40))}</span>` : p.required ? "" : '<span class="text-text-faint text-[11px]">opcional</span>'
		}</span>`;
	}

	// while typing the name: the list of commands, each with its parameters.
	// once a command and a space are typed: the panel of its parameters.
	function updateMenu() {
		if (!menu) return;
		const typed = input.value;

		const withArgs = /^(\/\S+)\s([\s\S]*)$/.exec(typed);
		const active = withArgs ? Commands.find((c) => c.name === withArgs[1].toLowerCase()) : undefined;
		if (active?.params.length) {
			const value = withArgs![2].trim();
			menu.innerHTML = `<div class="px-3.5 py-3">
				<div class="flex flex-wrap items-center gap-2"><span class="text-text font-mono text-[13px] font-semibold">${active.name}</span>${active.params.map((p) => paramBox(p, value)).join("")}</div>
				${active.params
					.map(
						(p) => `<p class="text-text-faint mt-2 text-[12.5px] leading-snug"><span class="text-text-dim font-semibold">${escapeHtml(p.name)}</span> · ${p.required ? "obligatorio" : "opcional"} — ${escapeHtml(p.desc)}</p>
						${
							p.choices
								? `<div class="mt-2 flex flex-wrap gap-1.5">${p.choices
										.map(
											(c) => `<button type="button" data-choice="${escapeHtml(active.name)} ${escapeHtml(c)}" class="border-border text-text-dim hover:border-brand hover:text-brand rounded-md border px-2 py-0.5 font-mono text-[12px] transition-colors">${escapeHtml(c)}</button>`,
										)
										.join("")}</div>`
								: ""
						}`,
					)
					.join("")}
				<p class="text-text-faint mt-2 text-[11.5px]"><kbd class="font-mono">Enter</kbd> para enviar · <kbd class="font-mono">Esc</kbd> para cerrar</p>
			</div>`;
			menu.hidden = false;
			return;
		}

		const matches = /^\/\S*$/.test(typed) ? Commands.filter((c) => c.name.startsWith(typed.toLowerCase())) : [];
		if (!matches.length) return hideMenu();
		menu.innerHTML = matches
			.map(
				(c) => `<button type="button" data-pick="${c.name}" class="hover:bg-card-hover flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-3.5 py-2 text-left transition-colors">
					<span class="text-text font-mono text-[13px] font-semibold">${c.name}</span>
					${c.params.map((p) => paramBox(p)).join("")}
					<span class="text-text-faint min-w-0 flex-1 truncate text-[12.5px]">${escapeHtml(c.desc)}</span>
				</button>`,
			)
			.join("");
		menu.hidden = false;
	}

	function clearInput() {
		input.value = "";
		autosize();
		hideMenu();
	}

	// picking a command: ones with no parameters run right away; the rest are
	// left typed with the parameter panel open (all optional: enter sends them as-is).
	function pickCommand(name: string) {
		const command = Commands.find((c) => c.name === name);
		if (!command?.params.length) return void send(name);
		input.value = `${name} `;
		autosize();
		updateMenu();
		input.focus();
	}

	// Un comando se pinta como cualquier mensaje, pero no se guarda hasta que hace
	// falta (solo /ticket, cuando prepara una propuesta).
	function pushExchange(userText: string) {
		emptyEl.hidden = true;
		messagesEl.insertAdjacentHTML("beforeend", userBubble(escapeHtml(userText)));
		messagesEl.insertAdjacentHTML("beforeend", assistantBubble('<span class="animate-status-pulse text-text-faint">…</span>'));
		const bubble = messagesEl.lastElementChild as HTMLElement;
		scrollDown();
		return { body: bubble.querySelector<HTMLElement>("[data-body]")!, extras: bubble.querySelector<HTMLElement>("[data-extras]")! };
	}

	async function runCommand(name: CommandName, note: string, text: string) {
		setStatus("");
		if (name === "ticket" && !conversationId && !note) {
			return setStatus("Cuéntame primero qué necesitas, o escribe /ticket seguido de una descripción.");
		}

		clearInput();
		busy = true;
		sendBtn.disabled = true;
		const { body, extras } = pushExchange(text);
		const failure = (message: string, extra = "") => {
			body.innerHTML = `<p class="text-red-400">${escapeHtml(message)}</p>${extra}`;
			decorate(body);
		};

		try {
			const res =
				name === "usage"
					? await fetch("/api/chat/usage", { headers: { Accept: "application/json" } })
					: name === "ticket"
						? await fetch("/api/chat/ticket", {
								method: "POST",
								headers: { "Content-Type": "application/json" },
								body: JSON.stringify({ conversationId, note }),
							})
						: await fetch("/api/chat/command", {
								method: "POST",
								headers: { "Content-Type": "application/json" },
								body: JSON.stringify({ name, arg: note, conversationId }),
							});
			if (res.status === 401) return login();
			const data = await res.json().catch(() => ({}));

			if (!res.ok) {
				if (data.error === "consent_required") {
					body.closest("[data-assistant]")?.previousElementSibling?.remove();
					body.closest("[data-assistant]")?.remove();
					input.value = text;
					return showConsent();
				}
				if (data.usage) setUsage(data.usage);
				// with a ticket already open, the button to go to it is offered.
				const link = data.url ? `<p><a href="${escapeHtml(data.url)}">Ir a tu ticket</a></p>` : "";
				return failure(data.message ?? "No se pudo completar el comando.", link);
			}

			if (name === "usage") {
				body.innerHTML = usageCardHtml(data);
				setUsage(data);
			} else {
				if (data.conversationId) conversationId = data.conversationId;
				if (data.guild) {
					setGuild(data.guild.name ?? data.guild);
					chosenGuild = true;
				}
				body.innerHTML = data.html;
				decorate(body);
				if (data.proposal) extras.innerHTML = proposalCard({ ...data.proposal, status: "pending", ticketId: null });
				// /servidor: one button per guild.
				if (Array.isArray(data.guilds) && data.guilds.length) extras.innerHTML = serverChips(data.guilds);
				if (data.usage) setUsage(data.usage);
				if (data.proposal || data.conversationId) {
					const fresh = await fetchState();
					if (fresh) {
						state = fresh;
						renderList();
					}
				}
			}
		} catch {
			failure("No se pudo completar el comando. Inténtalo de nuevo.");
		} finally {
			busy = false;
			sendBtn.disabled = false;
			scrollDown();
			input.focus();
		}
	}

	// reads the sse stream (events separated by a blank line).
	async function readEvents(res: Response, onEvent: (event: string, data: any) => void) {
		const reader = res.body!.getReader();
		const decoder = new TextDecoder();
		let buffer = "";
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			buffer += decoder.decode(value, { stream: true });
			let end: number;
			while ((end = buffer.indexOf("\n\n")) !== -1) {
				const raw = buffer.slice(0, end);
				buffer = buffer.slice(end + 2);
				const event = /^event: (.*)$/m.exec(raw)?.[1];
				const data = /^data: (.*)$/m.exec(raw)?.[1];
				if (event && data) onEvent(event, JSON.parse(data));
			}
		}
	}

	// ── Propuestas de ticket ───────────────────────────────────────────────────
	messagesEl.addEventListener("click", async (event) => {
		const server = (event.target as HTMLElement).closest<HTMLElement>("[data-server]");
		if (server) {
			const retry = server.closest<HTMLElement>("[data-retry]")?.dataset.retry;
			chosenGuild = false;
			await send(`/servidor ${server.dataset.server}`);
			// if it came from "which guild?", whatever was asked repeats, now with a guild chosen.
			if (retry && chosenGuild) await send(retry);
			return;
		}

		const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-act]");
		const card = button?.closest<HTMLElement>("[data-proposal]");
		if (!button || !card) return;

		const id = card.dataset.proposal!;
		const status = card.querySelector<HTMLElement>("[data-proposal-status]")!;
		const buttons = card.querySelectorAll("button");
		buttons.forEach((b) => (b.disabled = true));
		const isSettings = card.dataset.kind === "settings";
		status.textContent = button.dataset.act === "confirm" ? (isSettings ? `Aplicando los cambios${card.dataset.guild ? ` en ${card.dataset.guild}` : ""}…` : "Abriendo el ticket…") : "";
		status.className = "text-text-faint mt-2 min-h-4 text-[12.5px]";

		const res = await fetch(`/api/chat/proposals/${encodeURIComponent(id)}`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ action: button.dataset.act }),
		}).catch(() => null);
		const data = (await res?.json().catch(() => ({}))) ?? {};

		if (!res || !res.ok) {
			buttons.forEach((b) => (b.disabled = false));
			status.textContent = data.message ?? "No se pudo completar. Inténtalo de nuevo.";
			status.className = "mt-2 min-h-4 text-[12.5px] text-red-400";
			return;
		}

		const title = card.querySelector("[data-subject]")?.textContent ?? "";
		const summary = card.querySelector("[data-summary]")?.textContent ?? "";
		const kind = isSettings ? "settings" : "ticket";
		const done: Proposal =
			button.dataset.act === "confirm"
				? { id, kind, guild: card.dataset.guild || null, subject: title, summary, status: "confirmed", ticketId: data.ticketId ?? null }
				: { id, kind, guild: card.dataset.guild || null, subject: title, summary, status: "dismissed", ticketId: null };
		card.outerHTML = proposalCard(done);
		// the result of the changes (what applied and what didn't) goes as a note below.
		if (isSettings && data.html) {
			messagesEl.insertAdjacentHTML("beforeend", noteBubble(data.html));
			decorate(messagesEl.lastElementChild);
			scrollDown();
		}
		if (button.dataset.act === "confirm" && !isSettings) {
			const fresh = await fetchState();
			if (fresh) {
				state = fresh;
				renderList();
			}
		}
	});

	// ── Consentimiento ─────────────────────────────────────────────────────────
	function showConsent() {
		messagesEl.hidden = true;
		composerWrap.hidden = true;
		consentEl.hidden = false;
	}

	function showChat() {
		consentEl.hidden = true;
		messagesEl.hidden = false;
		composerWrap.hidden = false;
	}

	const consentCheck = q<HTMLInputElement>("#consent-check");
	const consentBtn = q<HTMLButtonElement>("#consent-accept");
	consentCheck.addEventListener("change", () => (consentBtn.disabled = !consentCheck.checked));
	consentBtn.addEventListener("click", async () => {
		consentBtn.disabled = true;
		const res = await fetch("/api/chat/consent", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: "{}",
		}).catch(() => null);
		if (!res?.ok) {
			consentBtn.disabled = false;
			return;
		}
		showChat();
		input.focus();
	});

	// ── Entrada ────────────────────────────────────────────────────────────────
	function autosize() {
		input.style.height = "auto";
		input.style.height = `${Math.min(input.scrollHeight, 128)}px`;
	}

	input.addEventListener("input", () => {
		autosize();
		updateMenu();
		const max = state?.maxInputChars ?? 1200;
		setStatus(input.value.length > max ? `Máximo ${max} caracteres (llevas ${input.value.length}).` : "");
	});
	input.addEventListener("keydown", (event) => {
		if (menu && !menu.hidden) {
			if (event.key === "Escape") return void hideMenu();
			// Tab completa el primer comando que coincide.
			if (event.key === "Tab") {
				const first = menu.querySelector<HTMLElement>("[data-pick]");
				if (first) {
					event.preventDefault();
					pickCommand(first.dataset.pick!);
					return;
				}
			}
		}
		if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
			event.preventDefault();
			form.requestSubmit();
		}
	});
	form.addEventListener("submit", (event) => {
		event.preventDefault();
		void send(input.value);
	});
	sendBtn.addEventListener("click", () => {
		if (busy) controller?.abort();
	});

	root.querySelectorAll<HTMLElement>("[data-suggest]").forEach((chip) =>
		chip.addEventListener("click", () => void send(chip.dataset.suggest!)),
	);
	menu?.addEventListener("click", (event) => {
		const choice = (event.target as HTMLElement).closest<HTMLElement>("[data-choice]");
		if (choice) {
			input.value = choice.dataset.choice!;
			autosize();
			updateMenu();
			input.focus();
			return;
		}
		const item = (event.target as HTMLElement).closest<HTMLElement>("[data-pick]");
		if (item) pickCommand(item.dataset.pick!);
	});
	root.querySelectorAll<HTMLElement>("[data-command]").forEach((el) =>
		el.addEventListener("click", () => pickCommand(el.dataset.command!)),
	);
	root.querySelector("#new-chat")?.addEventListener("click", newConversation);
	root.querySelector("#new-chat-embed")?.addEventListener("click", newConversation);
	listEl?.addEventListener("click", (event) => {
		const item = (event.target as HTMLElement).closest<HTMLElement>("[data-conversation]");
		if (item) void openConversation(item.dataset.conversation!);
	});

	// ── Arranque ───────────────────────────────────────────────────────────────
	state = await fetchState();
	if (!state) {
		messagesEl.hidden = true;
		composerWrap.hidden = true;
		unavailableEl.hidden = false;
		return;
	}
	if (!state.configured) {
		messagesEl.hidden = true;
		composerWrap.hidden = true;
		unavailableEl.hidden = false;
		return;
	}

	routes = state.routes ?? {};
	if (state.staff) root.querySelector<HTMLElement>("#staff-link")?.removeAttribute("hidden");
	setUsage(state.usage);
	renderList();
	localizeTimes(root);
	if (!state.consented) showConsent();
	else input.focus();
}
