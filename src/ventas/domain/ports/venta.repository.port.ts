import { PaginaResultado } from '../../../common/paginacion';
import { Venta } from '../entities/venta.entity';

export interface FiltrosVenta {
  clienteId?: string;
  desde?: Date;
  hasta?: Date;
  pagina: number;
  limite: number;
}

/** PUERTO de salida: guardar y leer ventas. La implementación vive en infrastructure/adapters. */
export abstract class VentaRepositoryPort {
  /** Siguiente número de la secuencia de ventas (para armar V-000001). */
  abstract siguienteConsecutivo(): Promise<number>;
  abstract guardar(venta: Venta): Promise<void>;
  abstract buscarPorId(id: string): Promise<Venta | null>;
  abstract listar(filtros: FiltrosVenta): Promise<PaginaResultado<Venta>>;
  /** Todas las del vehículo, las más recientes primero. */
  abstract listarPorVin(vin: string): Promise<Venta[]>;
}
