/** Telegram rechaza mensajes de más de 4096 caracteres. */
export const LIMITE_TELEGRAM = 4096;

/** Parte un texto largo en mensajes que caben en Telegram, cortando en un salto de línea o un espacio si hay uno. */
export function dividirMensaje(texto: string, limite = LIMITE_TELEGRAM): string[] {
  const partes: string[] = [];
  let resto = texto.trim();
  while (resto.length > limite) {
    const ventana = resto.slice(0, limite);
    const corte = Math.max(ventana.lastIndexOf('\n'), ventana.lastIndexOf(' '));
    // Sin espacio ni salto en toda la ventana (una sola palabra enorme) se corta en el límite.
    const hasta = corte > 0 ? corte : limite;
    partes.push(resto.slice(0, hasta).trimEnd());
    resto = resto.slice(hasta).trimStart();
  }
  if (resto) partes.push(resto);
  return partes;
}
