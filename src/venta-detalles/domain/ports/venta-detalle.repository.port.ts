import { VentaDetalle } from '../entities/venta-detalle.entity';

/** PUERTO de salida: guardar y leer las líneas de las ventas. */
export abstract class VentaDetalleRepositoryPort {
  abstract guardarVarios(detalles: VentaDetalle[]): Promise<void>;
  abstract listarPorVentas(ventaIds: string[]): Promise<VentaDetalle[]>;
}
