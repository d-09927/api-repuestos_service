export interface LineaStockCommand {
  repuestoId: string;
  cantidad: number;
}

/** Varias líneas de una misma bodega que se mueven todo o nada (compras, ventas y pedidos). */
export interface MovimientoLoteCommand {
  bodega: string;
  lineas: LineaStockCommand[];
  /** Documento que origina el movimiento: número de compra o de venta. */
  referencia: string;
  motivo: string;
  /** Solo en salidas: true si lo que sale ya estaba reservado (pedido de una orden de taller). */
  desdeReserva?: boolean;
}
