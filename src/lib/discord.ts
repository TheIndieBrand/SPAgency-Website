const API = "https://discord.com/api/v10";
const ADMINISTRATOR = 0x8n;

export interface DiscordGuild {
	id: string;
	name: string;
	icon: string | null;
	owner: boolean;
	permissions: string;
}

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
	const res = await fetch(`${API}/users/@me/guilds`, {
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

export function hasAdminAccess(guild: DiscordGuild): boolean {
	if (guild.owner) return true;
	return (BigInt(guild.permissions) & ADMINISTRATOR) === ADMINISTRATOR;
}

export function guildIconUrl(guild: DiscordGuild): string | null {
	if (!guild.icon) return null;
	const ext = guild.icon.startsWith("a_") ? "gif" : "png";
	return `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.${ext}`;
}
