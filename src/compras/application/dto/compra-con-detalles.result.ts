import { Compra } from '../../domain/entities/compra.entity';
import { DetalleCompraInfo } from '../../domain/ports/compra-detalle.service.port';

/** Una compra junto con sus líneas. */
export interface CompraConDetalles {
  compra: Compra;
  detalles: DetalleCompraInfo[];
}
