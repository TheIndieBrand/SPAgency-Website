import type { APIRoute } from "astro";
import { generalInviteUrl } from "../lib/discord";

export const prerender = false;

// every "add to discord" button points here (site.inviteUrl): the invite is
// built on the server so the /gracias redirect can carry each environment's
// own domain (local or production), instead of hardcoding it in the page's code.
export const GET: APIRoute = ({ redirect }) => redirect(generalInviteUrl());
