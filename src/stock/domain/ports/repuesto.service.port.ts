/** Los datos de un repuesto que el stock necesita para armar el catálogo disponible. */
export interface RepuestoDelCatalogo {
  id: string;
  codigoUniversal: string | null;
  nombre: string;
  marca: string;
  categoria: string;
  /** Precio de catálogo en pesos, con IVA. */
  precio: number;
}

/**
 * PUERTO hacia el módulo de repuestos. Stock solo necesita saber si un repuesto existe y está activo,
 * y los datos básicos de los repuestos que tienen existencias (para el catálogo).
 * Hoy lo resuelve el módulo de repuestos dentro del mismo proceso (repuesto.local.adapter.ts);
 * si algún día se separa en otro servicio, se agrega un repuesto.http.adapter.ts y se cambia
 * el provider en el módulo, sin tocar el controlador ni el dominio.
 */
export abstract class RepuestoServicePort {
  /** Lanza NotFoundError si no existe y ConflictError si está desactivado. */
  abstract verificarRepuestoActivo(repuestoId: string): Promise<void>;
  /** Solo los activos; los ids que no existan o estén desactivados no vienen. */
  abstract activosPorIds(repuestoIds: string[]): Promise<RepuestoDelCatalogo[]>;
}
