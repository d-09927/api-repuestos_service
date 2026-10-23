export interface RepuestoInfo {
  id: string;
  sku: string;
  nombre: string;
  /** Precio de venta vigente en el catálogo. */
  precio: number;
}

/**
 * PUERTO hacia el módulo de repuestos. Ventas pide los datos y el precio vigente
 * de lo que va a vender. Hoy lo resuelve repuesto.local.adapter.ts (mismo proceso).
 */
export abstract class RepuestoServicePort {
  /** Lanza NotFoundError si alguno no existe y ConflictError si alguno está desactivado. */
  abstract obtenerActivos(repuestoIds: string[]): Promise<RepuestoInfo[]>;
}
