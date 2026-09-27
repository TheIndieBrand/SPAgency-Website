import type { DiscordUser } from "../discord";
import { listAccessibleGuilds } from "../dashboard-guard";
import { json } from "../session";
import { renderMessageHtml } from "../support-format";
import { ConsentVersion } from "./config";
import { dashboardAssistantService, type GuildRef } from "./DashboardAssistantService";
import { chatRepository } from "./ChatRepository";
import { chatRateLimiter } from "./ChatRateLimiter";

// chat commands that act on the dashboard. none of them call the model: they
// don't spend quota. only /servidor (choosing) and /panico (proposing) leave
// a trace (which is why they require accepting the notice, like any stored
// conversation). the chosen guild only applies to THAT conversation: it isn't
// carried over to others.

export type DashboardCommand = "servidor" | "config" | "panico" | "registros";

const html = (markdown: string) => renderMessageHtml(markdown);
const plain = (text: string) => text.replace(/[<>*_`]/g, "");

const NoGuild: Record<"none" | "multiple" | "unavailable", string> = {
	none: "No administras ningún servidor donde esté SP Agency. Invítalo desde /dashboard.",
	multiple: "Administras varios servidores. Elige uno con /servidor.",
	unavailable: "No he podido comprobar tus servidores ahora mismo. Inténtalo de nuevo en un momento.",
};

const consentRequired = () => json({ error: "consent_required", message: "Acepta el aviso para usar el asistente." }, 403);

export async function dashboardCommand(input: {
	user: DiscordUser;
	accessToken: string;
	name: DashboardCommand;
	arg: string;
	conversationId?: string;
}): Promise<Response> {
	const { user, accessToken, name } = input;
	const arg = input.arg.trim().slice(0, 100);

	if (!chatRateLimiter.withinRate(user.id)) return json({ error: "rate_limited", message: "Vas muy rápido. Espera unos segundos." }, 429);
	if (input.conversationId && chatRepository.getConversation(input.conversationId)?.userId !== user.id) {
		return json({ error: "not_found", message: "Esa conversación no existe." }, 404);
	}

	// ── /servidor [name | number] ────────────────────────────────────────────
	if (name === "servidor") {
		const list = await listAccessibleGuilds(accessToken).catch(() => null);
		if (!list) return json({ error: "unavailable", message: NoGuild.unavailable }, 502);
		if (!list.length) return json({ html: html(NoGuild.none), guilds: [] });

		const guilds: GuildRef[] = list.map((g) => ({ id: g.id, name: g.name }));
		if (!arg) {
			const current = input.conversationId ? chatRepository.getConversationGuild(input.conversationId)?.id : undefined;
			return json({
				html: html("Elige el servidor sobre el que quieres que actúe en esta conversación:"),
				guilds: guilds.map((g) => ({ ...g, current: g.id === current })),
			});
		}

		const chosen = dashboardAssistantService.matchGuild(guilds, arg);
		if (!chosen) return json({ error: "not_found", message: "No encuentro ese servidor entre los que administras. Escribe /servidor para ver la lista." }, 404);
		if (!chatRepository.hasConsent(user.id, ConsentVersion)) return consentRequired();

		// choosing leaves a trace: the conversation remembers the guild and says so in the history.
		const conversationId = input.conversationId ?? chatRepository.createConversation(user.id, user.global_name || user.username, `Servidor: ${chosen.name}`);
		chatRepository.setConversationGuild(conversationId, chosen);
		const text = `Listo: en esta conversación trabajo con **${plain(chosen.name)}**. Todo lo que cambie se aplicará ahí.`;
		chatRepository.addMessage({ conversationId, role: "user", content: `/servidor ${arg}` });
		chatRepository.addMessage({ conversationId, role: "assistant", content: text });
		return json({ conversationId, guild: chosen, html: html(text), guilds: [] });
	}

	// everything else needs a guild already resolved in this conversation.
	const selection = await dashboardAssistantService.resolveGuild(accessToken, input.conversationId);
	if (!selection.ok) return json({ error: "no_guild", message: NoGuild[selection.reason] }, selection.reason === "unavailable" ? 502 : 409);
	const { guild } = selection;

	const config = await dashboardAssistantService.loadConfigFor(guild);
	if (!config) return json({ error: "unavailable", message: "No he podido leer la configuración ahora mismo. Inténtalo de nuevo." }, 503);

	// ── /config [section] ────────────────────────────────────────────────────
	if (name === "config") {
		const text = dashboardAssistantService.configMarkdown(guild, config, arg);
		if (!text) return json({ error: "invalid_section", message: "Secciones: protección, automoderación, alertas o general." }, 400);
		return json({ guild, html: html(text) });
	}

	// ── /registros ──────────────────────────────────────────────────────────
	if (name === "registros") {
		const text = await dashboardAssistantService.recentActivityMarkdown(guild);
		if (!text) return json({ error: "unavailable", message: "No he podido leer los registros ahora mismo." }, 503);
		return json({ guild, html: html(text) });
	}

	// ── /panico [on | off] ──────────────────────────────────────────────────
	if (!chatRepository.hasConsent(user.id, ConsentVersion)) return consentRequired();

	const word = arg.toLowerCase();
	const enable = /^(on|si|sí|activar|activa|encender|enciende)$/.test(word)
		? true
		: /^(off|no|desactivar|desactiva|apagar|apaga)$/.test(word)
			? false
			: arg === ""
				? !dashboardAssistantService.readSetting(config, "raidmodeEnable")
				: null;
	if (enable === null) return json({ error: "invalid_argument", message: "Usa /panico, /panico on o /panico off." }, 400);

	const built = dashboardAssistantService.buildSettingsProposal(guild, config, [{ key: "raidmodeEnable", value: enable }]);
	if (!built.payload) return json({ guild, html: html(`El Modo Pánico de **${plain(guild.name)}** ya estaba ${enable ? "activado" : "desactivado"}.`) });

	const where = `**${plain(guild.name)}**`;
	const text = enable
		? `Esto activa el **Modo Pánico** en ${where}: el bot endurece la protección del servidor hasta que se apague solo o lo desactives. Confírmalo si es lo que quieres:`
		: `Esto desactiva el **Modo Pánico** en ${where}. Confírmalo si es lo que quieres:`;
	const conversationId = input.conversationId ?? chatRepository.createConversation(user.id, user.global_name || user.username, "Modo Pánico");
	chatRepository.setConversationGuild(conversationId, guild);
	chatRepository.addMessage({ conversationId, role: "user", content: `/panico${arg ? ` ${arg}` : ""}` });
	const proposalId = chatRepository.createProposal({ conversationId, userId: user.id, kind: "settings", subject: built.subject, summary: built.summary, payload: built.payload });
	chatRepository.addMessage({ conversationId, role: "assistant", content: text, proposalId });

	return json({
		conversationId,
		guild,
		html: html(text),
		proposal: { id: proposalId, kind: "settings", guild: guild.name, subject: built.subject, summary: built.summary },
	});
}
