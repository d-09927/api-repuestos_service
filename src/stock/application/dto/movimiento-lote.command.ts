export interface LineaStockCommand {
  repuestoId: string;
  cantidad: number;
}

/** Varias líneas de una misma bodega que se mueven todo o nada (compras y ventas). */
export interface MovimientoLoteCommand {
  bodega: string;
  lineas: LineaStockCommand[];
  /** Documento que origina el movimiento: número de compra o de venta. */
  referencia: string;
  motivo: string;
}
