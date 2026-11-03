export interface MovimientoDeVenta {
  bodega: string;
  /** Número de la venta: queda en el historial de movimientos del stock. */
  referencia: string;
  lineas: { repuestoId: string; cantidad: number }[];
  /** true: salen de lo reservado (entrega de un pedido). */
  desdeReserva?: boolean;
}

/**
 * PUERTO hacia el módulo de stock. Hoy lo resuelve stock.local.adapter.ts (mismo proceso);
 * si el stock se separa en otro servicio, será un stock.http.adapter.ts.
 */
export abstract class StockServicePort {
  /**
   * Resta las unidades del stock disponible. Todas las líneas o ninguna:
   * si una no alcanza, lanza StockInsuficienteError y no se mueve nada.
   */
  abstract descontarMercancia(movimiento: MovimientoDeVenta): Promise<void>;
  /** Devuelve las unidades al stock si la venta no pudo guardarse. */
  abstract revertirDescuento(movimiento: MovimientoDeVenta): Promise<void>;
}
