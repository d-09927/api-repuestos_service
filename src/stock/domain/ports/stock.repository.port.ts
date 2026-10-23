import { StockItem } from '../entities/stock-item.entity';

/**
 * PUERTO de salida del stock.
 *
 * `bloquear*` lee las filas con bloqueo (SELECT ... FOR UPDATE) dentro de la transacción en curso:
 * nadie más las modifica hasta el commit, así dos salidas simultáneas no dejan el stock en negativo.
 * Solo funcionan dentro de `UnidadDeTrabajoPort.ejecutar`.
 */
export abstract class StockRepositoryPort {
  abstract bloquear(repuestoId: string, bodega: string): Promise<StockItem | null>;
  /** Bloquea siempre en el mismo orden (por repuestoId) para evitar bloqueos cruzados. */
  abstract bloquearVarios(bodega: string, repuestoIds: string[]): Promise<Map<string, StockItem | null>>;
  abstract guardar(stock: StockItem): Promise<void>;
  abstract listarPorRepuesto(repuestoId: string): Promise<StockItem[]>;
  abstract listarBajoMinimo(): Promise<StockItem[]>;
}
