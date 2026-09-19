import type { AstroCookies } from "astro";
import { getCurrentUser, type DiscordUser } from "./discord";

// Reutiliza la sesión del login con Discord (cookie con el access_token). No
// borra la cookie si algo falla: estas comprobaciones también se usan en
// páginas públicas, donde no tener sesión es lo normal.
export async function getSessionUser(cookies: AstroCookies): Promise<DiscordUser | null> {
	const raw = cookies.get(process.env.SESSION_COOKIE_NAME || "spa_session")?.value;
	if (!raw) return null;

	let accessToken: string | undefined;
	try {
		accessToken = JSON.parse(raw)?.access_token;
	} catch {
		return null;
	}

	return accessToken ? getCurrentUser(accessToken) : null;
}

export function json(data: unknown, status = 200): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

// Guardia de los endpoints con sesión. Las peticiones que escriben exigen
// Content-Type JSON: un formulario de otra web no puede enviarlo así sin pasar
// por CORS (que aquí no está habilitado), lo que evita el CSRF.
export async function requireUser(
	request: Request,
	cookies: AstroCookies,
): Promise<{ user: DiscordUser } | { response: Response }> {
	if (request.method !== "GET" && !request.headers.get("content-type")?.includes("application/json")) {
		return { response: json({ error: "unsupported_media_type", message: "Petición no válida." }, 415) };
	}

	const user = await getSessionUser(cookies);
	if (!user) {
		return { response: json({ error: "unauthorized", message: "Inicia sesión para continuar." }, 401) };
	}

	return { user };
}

// Ruta interna a la que volver tras el login (?next=/support). Solo rutas
// relativas del propio sitio: nada de "//otro.com" ni "\" (open redirect).
export function safeNextPath(value: string | null | undefined): string | null {
	if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
	return /^\/[\w\-./%?=&]*$/.test(value) ? value : null;
}
