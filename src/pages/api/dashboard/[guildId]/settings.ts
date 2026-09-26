import type { APIRoute } from "astro";
import { recordSettingChange } from "../../../../lib/audit";
import { requireGuildApi } from "../../../../lib/dashboard-guard";
import { settingsRepository } from "../../../../lib/db/SettingsRepository";
import { json } from "../../../../lib/session";

export const prerender = false;

// Cambia un ajuste del servidor (el autoguardado del dashboard). Cuerpo:
//   { key, value }              → valor suelto (interruptor, opción, número, ID…)
//   { key, op: "add"|"remove", value }  → un elemento de una lista
// La identidad y el servidor se comprueban en cada petición; la clave se valida
// contra el registro de ajustes y nunca decide qué tabla o columna se toca.
export const PATCH: APIRoute = async ({ request, cookies, params }) => {
	const auth = await requireGuildApi(request, cookies, params.guildId);
	if ("response" in auth) return auth.response;

	const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
	if (!body || typeof body.key !== "string") return json({ error: "invalid_body", message: "Petición no válida." }, 400);

	const result = await settingsRepository.changeSetting(auth.guild.id, {
		key: body.key,
		value: body.value,
		op: body.op === "add" || body.op === "remove" ? body.op : undefined,
	});
	if (!result.ok) return json({ error: result.error, message: result.message }, result.status);

	const changed = JSON.stringify(result.old) !== JSON.stringify(result.value);
	if (changed) recordSettingChange({ guildId: auth.guild.id, userId: auth.userId, key: result.key, old: result.old, value: result.value });

	const response = json({ ok: true, key: result.key, value: result.value, activatedAt: result.activatedAt });
	response.headers.set("Cache-Control", "no-store");
	return response;
};
