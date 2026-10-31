/** Palabras que no ayudan a encontrar un repuesto. */
const VACIAS = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'un', 'una', 'unos', 'unas', 'y', 'o', 'para', 'con', 'por', 'en', 'a']);

/** Minúsculas y sin tildes (la ñ queda como n), igual que sinTildesSql en la base de datos. */
export function sinTildes(texto: string): string {
  return texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * Las palabras de una búsqueda listas para comparar: sin tildes, sin palabras vacías y sin la "s"
 * del plural, para que "bujías de iridio" encuentre "Bujía de iridio".
 */
export function palabrasDeBusqueda(texto: string): string[] {
  return sinTildes(texto)
    .split(/\s+/)
    .filter((p) => p && !VACIAS.has(p))
    .map((p) => (p.length > 4 && p.endsWith('s') ? p.slice(0, -1) : p));
}

/** Expresión SQL que pone una columna en minúsculas y sin tildes (Postgres, sin la extensión unaccent). */
export function sinTildesSql(columna: string): string {
  return `translate(lower(coalesce(${columna}, '')), 'áéíóúüàèìòùñ', 'aeiouuaeioun')`;
}
