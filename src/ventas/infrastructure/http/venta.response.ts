import { VentaConDetalles } from '../../application/dto/venta-con-detalles.result';

export function toVentaResponse({ venta: v, detalles }: VentaConDetalles) {
  return {
    id: v.id,
    numero: v.numero,
    clienteId: v.clienteId,
    bodega: v.bodega,
    observaciones: v.observaciones,
    total: v.total,
    estado: v.estado,
    referenciaPago: v.referenciaPago,
    pagadaEn: v.pagadaEn,
    fecha: v.fecha,
    detalles: detalles.map((d) => ({
      repuestoId: d.repuestoId,
      sku: d.sku,
      nombre: d.nombre,
      cantidad: d.cantidad,
      precioUnitario: d.precioUnitario,
      subtotal: d.subtotal,
    })),
  };
}
