import { Movimiento } from '../../domain/entities/movimiento.entity';

export function toMovimientoResponse(m: Movimiento) {
  return {
    id: m.id,
    repuestoId: m.repuestoId,
    bodega: m.bodega,
    tipo: m.tipo,
    cantidad: m.cantidad,
    cantidadResultante: m.cantidadResultante,
    motivo: m.motivo,
    referencia: m.referencia,
    creadoEn: m.creadoEn,
  };
}
