import { TipoMovimiento } from '../../domain/enums/tipo-movimiento.enum';

export interface RegistrarMovimientoCommand {
  repuestoId: string;
  bodega: string;
  tipo: TipoMovimiento;
  cantidad: number;
  cantidadResultante: number;
  motivo?: string | null;
  referencia?: string | null;
}
