import type { APIRoute } from "astro";
import { generalInviteUrl } from "../lib/discord";

export const prerender = false;

// Todos los botones «Añadir a Discord» apuntan aquí (site.inviteUrl): la invitación se
// construye en el servidor para poder añadirle la redirección a /gracias con el dominio
// de cada entorno (local o producción), sin fijarlo en el código de la página.
export const GET: APIRoute = ({ redirect }) => redirect(generalInviteUrl());
