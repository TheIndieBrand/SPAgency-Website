import type { AstroCookies } from "astro";
import type { DiscordUser } from "../discord";
import { getSessionUser, json } from "../session";

// staff is the list of discord ids in STAFF_IDS (comma-separated). without
// the variable, nobody is staff: fails closed.
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

// guard for staff endpoints. checked on the server on every request; hiding
// the link protects nothing. the ones that write require json (same
// anti-csrf reason as requireUser).
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
