import { Venta } from '../../domain/entities/venta.entity';
import { DetalleVentaInfo } from '../../domain/ports/venta-detalle.service.port';

/** Una venta junto con sus líneas. */
export interface VentaConDetalles {
  venta: Venta;
  detalles: DetalleVentaInfo[];
}
