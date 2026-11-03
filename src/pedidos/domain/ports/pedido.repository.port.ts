import { Pedido } from '../entities/pedido.entity';
import { EstadoPedido } from '../enums/estado-pedido.enum';

/** PUERTO de salida: guardar y leer pedidos. La implementación vive en infrastructure/adapters. */
export abstract class PedidoRepositoryPort {
  /** Lanza ConflictError si otra petición creó el pedido de la misma orden al mismo tiempo. */
  abstract guardar(pedido: Pedido): Promise<void>;
  abstract buscarPorCodigoOrden(codigoOrden: string): Promise<Pedido | null>;
  abstract listar(estado?: EstadoPedido): Promise<Pedido[]>;
}
