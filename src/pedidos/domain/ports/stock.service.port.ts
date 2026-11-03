/** Varias líneas de una misma bodega que se mueven todo o nada. */
export interface MovimientoDePedido {
  bodega: string;
  /** Código de la orden: queda en el historial de movimientos del stock. */
  referencia: string;
  lineas: { repuestoId: string; cantidad: number }[];
}

/** PUERTO hacia el módulo de stock. */
export abstract class StockServicePort {
  /** Unidades disponibles (físico menos reservado) del repuesto en cada bodega. */
  abstract disponiblePorBodega(repuestoId: string): Promise<{ bodega: string; disponible: number }[]>;
  /** Aparta las unidades. Todo o nada: si una línea no alcanza, lanza error y no aparta nada. */
  abstract reservar(movimiento: MovimientoDePedido): Promise<void>;
  /** Devuelve a disponible lo apartado. */
  abstract liberar(movimiento: MovimientoDePedido): Promise<void>;
}
