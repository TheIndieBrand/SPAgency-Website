import { RATE_PER_MINUTE } from "./config";

// Límite por usuario y minuto, compartido por los mensajes y los comandos.
const recent = new Map<string, number[]>(); // marcas de tiempo por usuario

export function withinRate(userId: string): boolean {
	const cutoff = Date.now() - 60_000;
	const stamps = (recent.get(userId) ?? []).filter((t) => t > cutoff);
	if (stamps.length >= RATE_PER_MINUTE) {
		recent.set(userId, stamps);
		return false;
	}
	stamps.push(Date.now());
	recent.set(userId, stamps);
	return true;
}
