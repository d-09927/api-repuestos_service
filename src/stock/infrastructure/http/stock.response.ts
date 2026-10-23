import { StockItem } from '../../domain/entities/stock-item.entity';

export function toStockResponse(s: StockItem) {
  const disponible = s.cantidad - s.reservada;
  return {
    id: s.id,
    repuestoId: s.repuestoId,
    bodega: s.bodega,
    cantidad: s.cantidad,
    reservada: s.reservada,
    disponible,
    minimo: s.minimo,
    bajoMinimo: disponible <= s.minimo,
    ubicacion: s.ubicacion,
    actualizadoEn: s.actualizadoEn,
  };
}
