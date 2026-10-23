/**
 * PUERTO hacia el módulo de proveedores. Compras solo necesita saber si el proveedor
 * existe y está activo. Hoy lo resuelve proveedor.local.adapter.ts (mismo proceso).
 */
export abstract class ProveedorServicePort {
  /** Lanza NotFoundError si no existe y ConflictError si está desactivado. */
  abstract verificarProveedorActivo(proveedorId: string): Promise<void>;
}
