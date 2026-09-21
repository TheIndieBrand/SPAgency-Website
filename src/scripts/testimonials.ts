// Formulario de /testimonios: contador de caracteres y envío. El comentario queda
// PENDIENTE hasta que lo apruebe el staff; aquí solo se avisa de ello.
const form = document.getElementById("comment-form") as HTMLFormElement | null;

if (form) {
	const max = Number(form.dataset.max);
	const textarea = form.elements.namedItem("comment") as HTMLTextAreaElement;
	const button = form.querySelector<HTMLButtonElement>("button[type=submit]")!;
	const counter = document.getElementById("counter")!;
	const status = document.getElementById("form-status")!;

	const updateCounter = () => {
		counter.textContent = `${textarea.value.trim().length}/${max}`;
	};
	textarea.addEventListener("input", updateCounter);
	updateCounter();

	const say = (text: string, kind: "error" | "ok") => {
		status.textContent = text;
		status.className = `text-sm ${kind === "error" ? "text-red-400" : "text-emerald"}`;
	};

	form.addEventListener("submit", async (event) => {
		event.preventDefault();
		button.disabled = true;
		say("", "ok");

		try {
			const res = await fetch("/api/testimonials", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ comment: textarea.value }),
			});
			const data = await res.json().catch(() => ({}));

			if (res.status === 401) {
				window.location.href = "/auth/discord/login?next=/testimonios";
				return;
			}
			if (!res.ok) {
				say(data.message ?? "No se pudo enviar el comentario.", "error");
				button.disabled = false;
				return;
			}

			// Se recarga para mostrar el aviso de "pendiente" que pinta el servidor.
			window.location.reload();
		} catch {
			say("No se pudo conectar. Inténtalo de nuevo.", "error");
			button.disabled = false;
		}
	});
}
