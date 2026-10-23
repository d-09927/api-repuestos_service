export interface RepuestoInfo {
  id: string;
  sku: string;
  nombre: string;
}

/**
 * PUERTO hacia el módulo de repuestos. Compras pide los datos de los repuestos que va a comprar.
 * Hoy lo resuelve repuesto.local.adapter.ts (mismo proceso).
 */
export abstract class RepuestoServicePort {
  /** Lanza NotFoundError si alguno no existe y ConflictError si alguno está desactivado. */
  abstract obtenerActivos(repuestoIds: string[]): Promise<RepuestoInfo[]>;
}
