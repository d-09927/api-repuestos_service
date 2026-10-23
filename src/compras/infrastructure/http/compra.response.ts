import { CompraConDetalles } from '../../application/dto/compra-con-detalles.result';

export function toCompraResponse({ compra: c, detalles }: CompraConDetalles) {
  return {
    id: c.id,
    numero: c.numero,
    proveedorId: c.proveedorId,
    bodega: c.bodega,
    numeroFacturaProveedor: c.numeroFacturaProveedor,
    observaciones: c.observaciones,
    total: c.total,
    fecha: c.fecha,
    detalles: detalles.map((d) => ({
      repuestoId: d.repuestoId,
      sku: d.sku,
      nombre: d.nombre,
      cantidad: d.cantidad,
      costoUnitario: d.costoUnitario,
      subtotal: d.subtotal,
    })),
  };
}
