import { VentaDetalle } from '../../domain/entities/venta-detalle.entity';

export function toVentaDetalleResponse(d: VentaDetalle) {
  return {
    repuestoId: d.repuestoId,
    sku: d.sku,
    nombre: d.nombre,
    cantidad: d.cantidad,
    precioUnitario: d.precioUnitario,
    subtotal: d.subtotal,
  };
}
