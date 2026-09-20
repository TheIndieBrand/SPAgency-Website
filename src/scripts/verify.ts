// Página de verificación (/verify/<token>): espera a que el captcha se resuelva y
// manda el token + la respuesta del captcha a /api/verify/complete. La identidad
// no se manda: la pone el servidor a partir de la sesión de Discord.
type Turnstile = { reset: () => void };

const root = document.getElementById("verify");
if (root) init(root);

function init(root: HTMLElement) {
	const token = root.dataset.token!;
	const button = document.getElementById("verify-button") as HTMLButtonElement;
	const status = document.getElementById("verify-status") as HTMLElement;
	const done = document.getElementById("verify-done") as HTMLElement;

	let captcha = "";

	// Turnstile llama a estas funciones por nombre (data-callback), así que tienen que ser globales.
	const w = window as unknown as {
		onCaptchaSolved: (response: string) => void;
		onCaptchaExpired: () => void;
		turnstile?: Turnstile;
	};

	w.onCaptchaSolved = (response) => {
		captcha = response;
		button.disabled = false;
		status.textContent = "";
	};
	w.onCaptchaExpired = () => {
		captcha = "";
		button.disabled = true;
	};

	// Un token de captcha solo vale una vez: tras cualquier intento hay que pedir otro.
	function resetCaptcha() {
		captcha = "";
		button.disabled = true;
		w.turnstile?.reset();
	}

	button.addEventListener("click", async () => {
		if (!captcha) return;

		button.disabled = true;
		status.textContent = "";

		try {
			const res = await fetch("/api/verify/complete", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ token, captcha }),
			});
			const data = await res.json().catch(() => ({}));

			if (res.ok) {
				root.hidden = true;
				done.hidden = false;
				return;
			}

			if (res.status === 401) {
				window.location.href = `/auth/discord/login?next=${encodeURIComponent(window.location.pathname)}`;
				return;
			}

			status.textContent = data.message ?? "No se pudo completar la verificación.";
			resetCaptcha();
		} catch {
			status.textContent = "No se pudo conectar. Inténtalo de nuevo.";
			resetCaptcha();
		}
	});
}
