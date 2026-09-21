const API = "https://discord.com/api/v10";
const ADMINISTRATOR = 0x8n;

export interface DiscordGuild {
	id: string;
	name: string;
	icon: string | null;
	owner: boolean;
	permissions: string;
	approximate_member_count?: number;
}

export interface DiscordUser {
	id: string;
	username: string;
	global_name: string | null;
	avatar: string | null;
}

// Permission bundle requested when inviting the bot: kick, ban, view audit
// log, manage channels/roles, read/send/manage messages, timeout members.
const BOT_PERMISSIONS = "1099780074646";

export interface DiscordToken {
	access_token: string;
	refresh_token: string;
	expires_in: number;
}

export async function exchangeCodeForToken(code: string): Promise<DiscordToken | null> {
	const res = await fetch(`${API}/oauth2/token`, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			client_id: process.env.DISCORD_CLIENT_ID!,
			client_secret: process.env.DISCORD_CLIENT_SECRET!,
			grant_type: "authorization_code",
			code,
			redirect_uri: process.env.DISCORD_REDIRECT_URI!,
		}),
	});

	if (!res.ok) return null;
	return res.json();
}

export async function getUserGuilds(accessToken: string): Promise<DiscordGuild[] | null> {
	const res = await fetch(`${API}/users/@me/guilds?with_counts=true`, {
		headers: { Authorization: `Bearer ${accessToken}` },
	});

	if (!res.ok) return null;
	return res.json();
}

export async function getCurrentUser(accessToken: string): Promise<DiscordUser | null> {
	const res = await fetch(`${API}/users/@me`, {
		headers: { Authorization: `Bearer ${accessToken}` },
	});

	if (!res.ok) return null;
	return res.json();
}

export async function getBotGuildIds(): Promise<Set<string>> {
	const botToken = process.env.DISCORD_BOT_TOKEN;
	if (!botToken) return new Set();

	const res = await fetch(`${API}/users/@me/guilds?limit=200`, {
		headers: { Authorization: `Bot ${botToken}` },
	});

	if (!res.ok) return new Set();
	const guilds: { id: string }[] = await res.json();
	return new Set(guilds.map((g) => g.id));
}

// Dueño del servidor, con el token del bot (la lista de servidores del usuario solo
// dice si ÉL es el dueño, no quién lo es).
export async function getGuildOwnerId(guildId: string): Promise<string | null> {
	const botToken = process.env.DISCORD_BOT_TOKEN;
	if (!botToken) return null;

	const res = await fetch(`${API}/guilds/${encodeURIComponent(guildId)}`, {
		headers: { Authorization: `Bot ${botToken}` },
	});
	if (!res.ok) return null;
	const guild = (await res.json()) as { owner_id?: string };
	return guild.owner_id ?? null;
}

export function hasAdminAccess(guild: DiscordGuild): boolean {
	if (guild.owner) return true;
	return (BigInt(guild.permissions) & ADMINISTRATOR) === ADMINISTRATOR;
}

export function guildIconUrl(guild: DiscordGuild): string | null {
	if (!guild.icon) return null;
	const ext = guild.icon.startsWith("a_") ? "gif" : "png";
	return `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.${ext}`;
}

export function userAvatarUrl(user: DiscordUser): string {
	if (!user.avatar) {
		const fallbackIndex = (BigInt(user.id) >> 22n) % 6n;
		return `https://cdn.discordapp.com/embed/avatars/${fallbackIndex}.png`;
	}
	const ext = user.avatar.startsWith("a_") ? "gif" : "png";
	return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${ext}`;
}

// A dónde vuelve Discord tras invitar al bot: la página de agradecimiento (/gracias),
// en el mismo dominio que el login. Esa URL tiene que estar entre los Redirects de la
// aplicación en el Developer Portal (OAuth2), como la del login. Con INVITE_REDIRECT="off"
// la invitación se hace sin redirección (Discord se queda en su pantalla de "Autorizado").
function thanksRedirect(): Record<string, string> {
	const login = process.env.DISCORD_REDIRECT_URI;
	if (!login || process.env.INVITE_REDIRECT === "off") return {};
	try {
		return { redirect_uri: `${new URL(login).origin}/gracias`, response_type: "code" };
	} catch {
		return {};
	}
}

// Invitación general (botón «Añadir a Discord»): el usuario elige el servidor en Discord.
// Conserva el client_id que ya tenía el botón (el de la invitación pública del bot), que
// no coincide con DISCORD_CLIENT_ID (el del login): la redirección a /gracias hay que
// registrarla en ESA aplicación. INVITE_CLIENT_ID lo cambia sin tocar el código.
const PUBLIC_INVITE_CLIENT_ID = "1038614901394002020";

export function generalInviteUrl(): string {
	const params = new URLSearchParams({
		client_id: process.env.INVITE_CLIENT_ID || PUBLIC_INVITE_CLIENT_ID,
		permissions: "8",
		scope: "bot applications.commands",
		...thanksRedirect(),
	});
	return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

export function botInviteUrl(guildId: string): string {
	const params = new URLSearchParams({
		client_id: process.env.DISCORD_CLIENT_ID!,
		scope: "bot",
		permissions: BOT_PERMISSIONS,
		guild_id: guildId,
		disable_guild_select: "true",
		...thanksRedirect(),
	});
	return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

export interface GuildPreview {
	name: string;
	iconUrl: string | null;
}

// Nombre e icono de un servidor donde está el bot, para decirle a quien se
// verifica "a qué" servidor entra. Es solo cosmético: cualquier fallo devuelve
// null y la página sigue sin él.
export async function getGuildPreview(guildId: string): Promise<GuildPreview | null> {
	const botToken = process.env.DISCORD_BOT_TOKEN;
	if (!botToken || !/^\d{15,25}$/.test(guildId)) return null;

	try {
		const res = await fetch(`${API}/guilds/${guildId}`, {
			headers: { Authorization: `Bot ${botToken}` },
			signal: AbortSignal.timeout(4000),
		});
		if (!res.ok) return null;

		const guild = (await res.json()) as { name?: string; icon?: string | null };
		if (!guild.name) return null;

		const ext = guild.icon?.startsWith("a_") ? "gif" : "png";
		return {
			name: guild.name,
			iconUrl: guild.icon ? `https://cdn.discordapp.com/icons/${guildId}/${guild.icon}.${ext}` : null,
		};
	} catch {
		return null;
	}
}
