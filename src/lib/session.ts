import type { AstroCookies } from "astro";
import { createHash } from "node:crypto";
import { getCurrentUser, type DiscordUser } from "./discord";
import { sessionCookieService } from "./SessionCookieService";

// La cookie de sesión solo guarda los tokens de Discord, así que saber quién es
// el usuario cuesta una llamada a /users/@me. El chat de soporte consulta cada
// pocos segundos: sin caché, cada consulta sería también una llamada a Discord
// (con su latencia y sus límites). Se recuerda la identidad un rato, por token.
//
// Solo en memoria del proceso, y con la clave hasheada. Coste: un token
// revocado en Discord puede seguir valiendo hasta USER_TTL_MS. Los fallos
// (token inválido) se recuerdan menos, para no martillear a Discord con un
// token malo y a la vez recuperarse pronto.
const USER_TTL_MS = 60_000;
const MISS_TTL_MS = 10_000;
const MAX_ENTRIES = 500;

const identityCache = new Map<string, { user: DiscordUser | null; expires: number }>();
const inFlight = new Map<string, Promise<DiscordUser | null>>();

function lookupUser(accessToken: string): Promise<DiscordUser | null> {
	const key = createHash("sha256").update(accessToken).digest("hex");

	const cached = identityCache.get(key);
	if (cached && cached.expires > Date.now()) return Promise.resolve(cached.user);

	// Varias peticiones a la vez del mismo usuario comparten una sola llamada.
	const pending = inFlight.get(key);
	if (pending) return pending;

	const request = getCurrentUser(accessToken)
		.then((user) => {
			if (identityCache.size >= MAX_ENTRIES) {
				const now = Date.now();
				for (const [k, v] of identityCache) if (v.expires <= now) identityCache.delete(k);
				if (identityCache.size >= MAX_ENTRIES) identityCache.clear();
			}
			identityCache.set(key, { user, expires: Date.now() + (user ? USER_TTL_MS : MISS_TTL_MS) });
			return user;
		})
		// Un fallo de red no es una respuesta de Discord: no se cachea.
		.catch(() => null)
		.finally(() => inFlight.delete(key));

	inFlight.set(key, request);
	return request;
}

// Reutiliza la sesión del login con Discord (cookie con el access_token). No
// borra la cookie si algo falla: estas comprobaciones también se usan en
// páginas públicas, donde no tener sesión es lo normal.
export async function getSessionUser(cookies: AstroCookies): Promise<DiscordUser | null> {
	const accessToken = sessionCookieService.readAccessToken(cookies);
	return accessToken ? lookupUser(accessToken) : null;
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
