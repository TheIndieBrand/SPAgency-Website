import type { APIRoute } from "astro";
import { userAvatarUrl } from "../../lib/discord";
import { getSessionUser, json } from "../../lib/session";

export const prerender = false;

// Quién está conectado, para la cuenta de la navbar. Las páginas públicas (home,
// docs) se generan sin sesión, así que la navbar lo pregunta aquí al cargar.
// Sin sesión no es un error: responde { user: null }. Nunca se cachea.
export const GET: APIRoute = async ({ cookies }) => {
	const user = await getSessionUser(cookies);
	const response = json({
		user: user
			? { id: user.id, name: user.global_name || user.username, username: user.username, avatar: userAvatarUrl(user) }
			: null,
	});
	response.headers.set("Cache-Control", "no-store");
	return response;
};
