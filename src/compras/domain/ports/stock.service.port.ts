export interface MovimientoDeCompra {
  bodega: string;
  /** Número de la compra: queda en el historial de movimientos del stock. */
  referencia: string;
  lineas: { repuestoId: string; cantidad: number }[];
}

/**
 * PUERTO hacia el módulo de stock. Hoy lo resuelve stock.local.adapter.ts (mismo proceso);
 * si el stock se separa en otro servicio, será un stock.http.adapter.ts.
 */
export abstract class StockServicePort {
  /** Suma las unidades al stock. Todas las líneas o ninguna. */
  abstract ingresarMercancia(movimiento: MovimientoDeCompra): Promise<void>;
  /** Deshace el ingreso si la compra no pudo guardarse. */
  abstract revertirIngreso(movimiento: MovimientoDeCompra): Promise<void>;
}
