import { PaginaResultado } from '../../../common/paginacion';
import { Compra } from '../entities/compra.entity';

export interface FiltrosCompra {
  proveedorId?: string;
  desde?: Date;
  hasta?: Date;
  pagina: number;
  limite: number;
}

/** PUERTO de salida: guardar y leer compras. La implementación vive en infrastructure/adapters. */
export abstract class CompraRepositoryPort {
  /** Siguiente número de la secuencia de compras (para armar C-000001). */
  abstract siguienteConsecutivo(): Promise<number>;
  abstract guardar(compra: Compra): Promise<void>;
  abstract buscarPorId(id: string): Promise<Compra | null>;
  abstract listar(filtros: FiltrosCompra): Promise<PaginaResultado<Compra>>;
}
