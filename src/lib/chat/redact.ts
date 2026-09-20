// Enmascara secretos evidentes antes de guardar un mensaje o enviarlo al
// proveedor de IA. No es un filtro exhaustivo (el aviso al usuario ya le pide no
// pegar credenciales): solo evita que un descuido quede guardado para siempre.

const PATTERNS: RegExp[] = [
	// Token de bot o de usuario de Discord.
	/\b[MNO][A-Za-z\d_-]{23,27}\.[\w-]{6,7}\.[\w-]{27,}\b/g,
	// Claves tipo sk-… de proveedores de IA.
	/\bsk-[A-Za-z0-9_-]{20,}\b/g,
	// Cabeceras y asignaciones: Authorization: Bearer …, token=…, password: …
	/\b(?:bearer|token|secret|password|contraseña|api[_-]?key)\b\s*[:=]?\s*["']?[A-Za-z0-9._~+/=-]{12,}["']?/gi,
];

export function redactSecrets(text: string): string {
	return PATTERNS.reduce((out, pattern) => out.replace(pattern, "[secreto eliminado]"), text);
}
