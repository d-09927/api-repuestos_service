import { CompraDetalle } from '../../domain/entities/compra-detalle.entity';

export function toCompraDetalleResponse(d: CompraDetalle) {
  return {
    repuestoId: d.repuestoId,
    sku: d.sku,
    nombre: d.nombre,
    cantidad: d.cantidad,
    costoUnitario: d.costoUnitario,
    subtotal: d.subtotal,
  };
}
