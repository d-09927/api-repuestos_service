import { TipoMovimiento } from '../enums/tipo-movimiento.enum';

/** Entidad de dominio: un renglón del historial de inventario. Cada cambio de stock deja uno. */
export class Movimiento {
  id: string;
  repuestoId: string;
  bodega: string;
  tipo: TipoMovimiento;
  /** Siempre positiva, salvo en AJUSTE donde es la diferencia (puede ser negativa). */
  cantidad: number;
  /** Unidades físicas en la bodega después del movimiento. */
  cantidadResultante: number;
  motivo: string | null;
  /** Documento que originó el movimiento (orden de compra, orden de taller, factura...). */
  referencia: string | null;
  creadoEn: Date;

  constructor(datos: Movimiento) {
    Object.assign(this, datos);
  }
}
