export type TipoMovimientoStock = 'ENTRADA' | 'SALIDA' | 'AJUSTE' | 'RESERVA' | 'LIBERACION';

/** Lo que el stock le pide registrar al historial de movimientos. */
export interface RegistroMovimiento {
  repuestoId: string;
  bodega: string;
  tipo: TipoMovimientoStock;
  cantidad: number;
  cantidadResultante: number;
  motivo: string | null;
  referencia: string | null;
}

/** PUERTO hacia el módulo de movimientos (otra tabla). */
export abstract class MovimientoServicePort {
  abstract registrar(movimientos: RegistroMovimiento[]): Promise<void>;
}
