import { VentaConDetalles } from '../../application/dto/venta-con-detalles.result';

export function toVentaResponse({ venta: v, detalles }: VentaConDetalles) {
  return {
    id: v.id,
    numero: v.numero,
    clienteId: v.clienteId,
    vin: v.vin,
    codigoOrden: v.codigoOrden,
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
      codigoUniversal: d.codigoUniversal,
      categoria: d.categoria,
      cantidad: d.cantidad,
      precioUnitario: d.precioUnitario,
      subtotal: d.subtotal,
    })),
  };
}
