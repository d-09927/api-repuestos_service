/**
 * PUERTO hacia el módulo de clientes. Ventas solo necesita saber si el cliente
 * existe y está activo. Hoy lo resuelve cliente.local.adapter.ts (mismo proceso).
 */
export abstract class ClienteServicePort {
  /** Lanza NotFoundError si no existe y ConflictError si está desactivado. */
  abstract verificarClienteActivo(clienteId: string): Promise<void>;
}
