/**
 * PUERTO: ejecuta varias operaciones como una sola transacción (todo o nada).
 * Los repositorios de cualquier módulo que se llamen dentro de `ejecutar`
 * participan automáticamente de la misma transacción.
 */
export abstract class UnidadDeTrabajoPort {
  abstract ejecutar<T>(trabajo: () => Promise<T>): Promise<T>;
}
