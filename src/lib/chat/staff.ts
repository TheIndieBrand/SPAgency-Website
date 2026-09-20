import type { AstroCookies } from "astro";
import type { DiscordUser } from "../discord";
import { getSessionUser, json } from "../session";

// El staff es la lista de IDs de Discord de STAFF_IDS (separados por comas).
// Sin la variable, nadie lo es: falla cerrado.
function staffIds(): Set<string> {
	return new Set(
		(process.env.STAFF_IDS ?? "")
			.split(",")
			.map((id) => id.trim())
			.filter(Boolean),
	);
}

export function isStaff(user: DiscordUser | null): boolean {
	return Boolean(user && staffIds().has(user.id));
}

// Guardia de los endpoints de staff. Se comprueba en el servidor en cada
// petición; ocultar el enlace no protege nada. Las que escriben exigen JSON
// (mismo motivo anti-CSRF que requireUser).
export async function requireStaff(
	request: Request,
	cookies: AstroCookies,
): Promise<{ user: DiscordUser } | { response: Response }> {
	if (request.method !== "GET" && !request.headers.get("content-type")?.includes("application/json")) {
		return { response: json({ error: "unsupported_media_type", message: "Petición no válida." }, 415) };
	}

	const user = await getSessionUser(cookies);
	if (!user) return { response: json({ error: "unauthorized", message: "Inicia sesión para continuar." }, 401) };
	if (!isStaff(user)) return { response: json({ error: "forbidden", message: "No tienes permiso." }, 403) };

	return { user };
}
