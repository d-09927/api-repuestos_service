import { PaginaResultado } from '../../../common/paginacion';
import { Repuesto } from '../entities/repuesto.entity';

export interface FiltrosRepuesto {
  texto?: string;
  marca?: string;
  categoria?: string;
  /** Si viene, solo se listan estos repuestos (p. ej. los compatibles con un vehículo). */
  ids?: string[];
  incluirInactivos?: boolean;
  pagina: number;
  limite: number;
}

/**
 * PUERTO de salida: lo que el módulo necesita para guardar y leer repuestos.
 * Es una clase abstracta (y no una interface) para poder usarla como token de inyección en Nest.
 */
export abstract class RepuestoRepositoryPort {
  abstract guardar(repuesto: Repuesto): Promise<void>;
  abstract buscarPorId(id: string): Promise<Repuesto | null>;
  abstract buscarPorSku(sku: string): Promise<Repuesto | null>;
  abstract listar(filtros: FiltrosRepuesto): Promise<PaginaResultado<Repuesto>>;
}
