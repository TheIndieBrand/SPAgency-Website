# Guía de contribución — SP Agency Website

Este documento define las convenciones de código para este proyecto (Astro + TypeScript + Express). Son de cumplimiento obligatorio en todo código nuevo y en cualquier refactor.

## 1. Paradigma y estructura

- **Orientación a objetos siempre que el dominio lo permita.** Lógica de negocio, servicios, repositorios de datos y modelos se implementan como clases (estilo Java): estado encapsulado, métodos con una responsabilidad, dependencias inyectadas por constructor.
- **Excepción: componentes `.astro` y scripts de UI/cliente.** Son plantillas y controladores de vista, no dominio de negocio — se mantienen como funciones/módulos, no se fuerza una clase donde no aporta valor.
- **Un archivo, una responsabilidad.** Un archivo no debe mezclar una clase de dominio con utilidades sueltas ni constantes.

## 2. Nomenclatura de archivos y clases

- **PascalCase para archivos que exportan una clase o componente**, con el nombre del archivo igual al nombre exportado:
  - `TicketRepository.ts` → `export class TicketRepository`
  - `DashboardCard.astro` → componente `DashboardCard`
- **PascalCase para nombres de clases**, sin excepción.
- Archivos que no exportan una clase (helpers puros, tipos, constantes) usan `camelCase` o el sufijo temático correspondiente (ver §4).

## 3. Funciones y métodos

- **Máximo 3 parámetros por función o método.** Si se necesitan más, se agrupan en un objeto de opciones tipado (`interface` o `type`) recibido como único parámetro.
- **Una función = una responsabilidad.** Si una función hace más de una cosa (ej. valida y además persiste, o transforma y además notifica), se divide en funciones separadas con nombres que describan exactamente esa única responsabilidad.
- Nombres de función en `camelCase`, verbo + sustantivo (`getUserById`, no `userData`).

## 4. Constantes

- Las constantes ya no se escriben en `SCREAMING_SNAKE_CASE`. Se usan en **PascalCase**, igual que una clase o un tipo:
  ```ts
  // Antes (prohibido)
  export const MAX_RETRIES = 3;

  // Ahora (correcto)
  export const MaxRetries = 3;
  ```
- Toda constante compartida entre varios archivos se agrupa por dominio en un fichero dedicado con el sufijo `.constants.ts`:
  - `Ticket.constants.ts` → `MaxOpenTickets`, `DefaultTicketPriority`, etc.
  - No se declaran constantes de configuración sueltas dentro de archivos de lógica; se importan desde su `.constants.ts` correspondiente.
- Constantes puramente locales y triviales dentro de una función (ej. un límite usado una sola vez, sin significado de dominio) pueden quedarse en `camelCase` dentro de la propia función — no todo necesita salir a un fichero de constantes.

## 5. Tipos e interfaces

- Uso de TypeScript estricto (ya configurado en `tsconfig.json`, `astro/tsconfigs/strict`). No se introduce `any` salvo justificación explícita en comentario.
- Interfaces y tipos en PascalCase, en archivos `<algo>.types.ts` cuando se comparten entre módulos.

## 6. Organización general

- Nada de lógica de negocio dentro de rutas de API (`src/pages/api/**`) más allá de orquestar: parsear input, invocar el servicio/clase correspondiente, devolver la respuesta.
- Acceso a base de datos encapsulado en clases repositorio (`src/lib/db`), nunca queries sueltas dispersas en componentes o endpoints.

## 7. Base de datos — sin cambios de esquema

- **La base de datos es compartida con el bot de Discord.** Ningún refactor de este repositorio puede cambiar el esquema (tablas, columnas, tipos), ni el significado o formato de los datos que ya existen.
- Envolver queries existentes en clases repositorio está permitido y es lo esperado; cambiar la query en sí (columnas leídas/escritas, condiciones, tipos devueltos) no lo está, salvo que el cambio se coordine explícitamente con el bot.
- Cualquier necesidad real de cambio de esquema se trata aparte, nunca como parte de un refactor de estilo de código.

## 8. Documentación (JSDoc)

- Todo elemento exportado (clase, método público, función, tipo) lleva JSDoc en **inglés**.
- El JSDoc documenta cada propiedad requerida: parámetros (`@param`), valor de retorno (`@returns`), y errores esperados (`@throws`) cuando aplique.
- Los comentarios descriptivos (la línea de resumen del JSDoc, comentarios inline) son **cortos y en minúscula**, con lenguaje natural y directo — se explica qué hace o por qué existe, sin sobrecargar de jerga.
- No se documentan obviedades ya evidentes por el nombre de la función o variable.

## 9. Antes de abrir un PR

- El código debe pasar `pnpm astro check` sin errores de tipado.
- Ningún archivo nuevo debe romper las convenciones anteriores; si una excepción es imprescindible, se justifica en el PR.
