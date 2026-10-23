import { PaginaResultado } from '../../../common/paginacion';
import { Movimiento } from '../entities/movimiento.entity';

export interface FiltrosMovimientos {
  repuestoId?: string;
  bodega?: string;
  pagina: number;
  limite: number;
}

/** PUERTO de salida: guardar y leer movimientos. */
export abstract class MovimientoRepositoryPort {
  abstract guardarVarios(movimientos: Movimiento[]): Promise<void>;
  abstract listar(filtros: FiltrosMovimientos): Promise<PaginaResultado<Movimiento>>;
}
