// a ticket's conversation: polls for new messages every few seconds (cursor
// = the last message's id, see docs/support.md), sends the user's, and
// allows closing the ticket. once the bot deletes the channel, the query
// returns 404 and it falls back to the transcript.
import { localizeTimes, messageHtml, type ChatMessage } from "./support-ui";

const PollMs = 3000;
const PollHiddenMs = 15000;
const PollClosingMs = 1500;
const PageSize = 50;

const root = document.getElementById("chat");
if (root) init(root);

function init(root: HTMLElement) {
	const ticketId = root.dataset.ticket!;
	const api = `/api/support/tickets/${encodeURIComponent(ticketId)}`;
	const historyUrl = `/support/history/${encodeURIComponent(ticketId)}`;

	const list = root.querySelector<HTMLElement>("#messages")!;
	const empty = root.querySelector<HTMLElement>("#empty")!;
	const form = root.querySelector<HTMLFormElement>("#composer")!;
	const input = form.querySelector<HTMLTextAreaElement>("textarea")!;
	const sendBtn = form.querySelector<HTMLButtonElement>("button[type=submit]")!;
	const closeBtn = root.querySelector<HTMLButtonElement>("#close-ticket")!;
	const statusEl = root.querySelector<HTMLElement>("#status")!;

	let cursor: string | null = null;
	let closing = false;
	let timer: number | undefined;

	function setStatus(text: string, error = false) {
		statusEl.textContent = text;
		statusEl.className = `min-h-5 text-sm ${error ? "text-red-400" : "text-text-faint"}`;
	}

	function schedule(delay: number) {
		window.clearTimeout(timer);
		timer = window.setTimeout(poll, document.hidden ? Math.max(delay, PollHiddenMs) : delay);
	}

	function append(messages: ChatMessage[]) {
		const nearBottom = window.innerHeight + window.scrollY >= document.body.scrollHeight - 200;
		const first = cursor === null;

		for (const m of messages) {
			if (list.querySelector(`[data-message-id="${CSS.escape(m.id)}"]`)) continue;
			list.insertAdjacentHTML("beforeend", messageHtml(m));
		}
		cursor = messages[messages.length - 1].id;
		empty.hidden = true;
		localizeTimes(list);

		if (first || nearBottom) window.scrollTo({ top: document.body.scrollHeight });
	}

	async function poll() {
		try {
			const res = await fetch(`${api}/messages${cursor ? `?after=${cursor}` : ""}`, {
				headers: { Accept: "application/json" },
			});

			// the bot no longer knows this ticket: it closed (and its transcript is already on the web).
			if (res.status === 404) return void (window.location.href = historyUrl);
			if (res.status === 401) {
				return void (window.location.href = `/auth/discord/login?next=${encodeURIComponent(window.location.pathname)}`);
			}

			const data = await res.json().catch(() => ({}));
			if (!res.ok) {
				setStatus(data.message ?? "Reconectando…", true);
				return schedule(6000);
			}

			if (!closing) setStatus("");
			if (data.messages.length) append(data.messages);
			schedule(data.messages.length >= PageSize ? 0 : closing ? PollClosingMs : PollMs);
		} catch {
			setStatus("Reconectando…", true);
			schedule(6000);
		}
	}

	async function post(url: string, body: unknown) {
		const res = await fetch(url, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		});
		const data = await res.json().catch(() => ({}));
		return { ok: res.ok, data };
	}

	form.addEventListener("submit", async (event) => {
		event.preventDefault();
		const content = input.value.trim();
		if (!content || closing) return;

		sendBtn.disabled = true;
		const { ok, data } = await post(`${api}/messages`, { content });
		sendBtn.disabled = false;

		if (!ok) return setStatus(data.message ?? "No se pudo enviar el mensaje.", true);

		input.value = "";
		setStatus("");
		schedule(0);
	});

	// enter sends; shift+enter adds a line break.
	input.addEventListener("keydown", (event) => {
		if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
			event.preventDefault();
			form.requestSubmit();
		}
	});

	closeBtn.addEventListener("click", async () => {
		if (!window.confirm("¿Cerrar este ticket? No se podrá reabrir, pero conservarás el transcript.")) return;

		closeBtn.disabled = true;
		const { ok, data } = await post(`${api}/close`, {});
		if (!ok) {
			closeBtn.disabled = false;
			return setStatus(data.message ?? "No se pudo cerrar el ticket.", true);
		}

		closing = true;
		form.hidden = true;
		closeBtn.hidden = true;
		setStatus("Cerrando el ticket… en un momento verás el transcript.");
		schedule(0);
	});

	document.addEventListener("visibilitychange", () => {
		if (!document.hidden) schedule(0);
	});

	poll();
}
