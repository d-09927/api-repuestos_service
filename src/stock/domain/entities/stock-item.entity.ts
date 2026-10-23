/**
 * Entidad de dominio: existencias de UN repuesto en UNA bodega.
 *  - cantidad:  unidades físicas en la bodega.
 *  - reservada: unidades apartadas para un pedido u orden de trabajo (siguen en la bodega).
 * Las reglas (entradas, salidas, reservas, ajustes) están en StockService.
 */
export class StockItem {
  id: string;
  repuestoId: string;
  bodega: string;
  cantidad: number;
  reservada: number;
  minimo: number;
  ubicacion: string | null;
  actualizadoEn: Date;

  constructor(datos: StockItem) {
    Object.assign(this, datos);
  }
}
