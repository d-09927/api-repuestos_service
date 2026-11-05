/** Colombia no usa horario de verano: la zona es siempre UTC-5. */
const ZONA_HORARIA = '-05:00';

const SOLO_FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** "2026-10-22" -> 22 de octubre 00:00 hora Colombia. Si ya trae hora, se respeta. */
export function inicioDelDia(valor: string): Date {
  return new Date(SOLO_FECHA.test(valor) ? `${valor}T00:00:00.000${ZONA_HORARIA}` : valor);
}

/** "2026-10-22" -> 22 de octubre 23:59:59.999 hora Colombia (el día completo cuenta). */
export function finDelDia(valor: string): Date {
  return new Date(SOLO_FECHA.test(valor) ? `${valor}T23:59:59.999${ZONA_HORARIA}` : valor);
}

/** La fecha en ISO 8601 con la zona de Colombia: 2026-05-02T10:15:00-05:00. */
export function fechaColombiaIso(fecha: Date): string {
  const local = new Date(fecha.getTime() - 5 * 60 * 60 * 1000);
  return `${local.toISOString().slice(0, 19)}${ZONA_HORARIA}`;
}
