/**
 * PUERTO hacia el módulo de repuestos. Stock solo necesita saber si un repuesto existe y está activo.
 * Hoy lo resuelve el módulo de repuestos dentro del mismo proceso (repuesto.local.adapter.ts);
 * si algún día se separa en otro servicio, se agrega un repuesto.http.adapter.ts y se cambia
 * el provider en el módulo, sin tocar el controlador ni el dominio.
 */
export abstract class RepuestoServicePort {
  /** Lanza NotFoundError si no existe y ConflictError si está desactivado. */
  abstract verificarRepuestoActivo(repuestoId: string): Promise<void>;
}
