/** Base común de entradas, salidas, reservas y liberaciones. */
export interface MovimientoStockCommand {
  repuestoId: string;
  bodega: string;
  cantidad: number;
  motivo?: string;
  /** Documento de origen: orden de compra, orden de taller, factura... */
  referencia?: string;
}

export interface EntradaStockCommand extends MovimientoStockCommand {
  /** Stock mínimo de alerta para este repuesto en esta bodega. */
  minimo?: number;
  ubicacion?: string;
}

export interface SalidaStockCommand extends MovimientoStockCommand {
  /** true si lo que se entrega ya estaba reservado. */
  desdeReserva?: boolean;
}

export interface AjusteStockCommand {
  repuestoId: string;
  bodega: string;
  cantidadNueva: number;
  motivo: string;
  referencia?: string;
}
