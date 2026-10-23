import { PaginaResultado } from '../../../common/paginacion';
import { Proveedor } from '../entities/proveedor.entity';

export interface FiltrosProveedor {
  texto?: string;
  incluirInactivos?: boolean;
  pagina: number;
  limite: number;
}

/** PUERTO de salida: guardar y leer proveedores. La implementación vive en infrastructure/adapters. */
export abstract class ProveedorRepositoryPort {
  abstract guardar(proveedor: Proveedor): Promise<void>;
  abstract buscarPorId(id: string): Promise<Proveedor | null>;
  abstract buscarPorNit(nit: string): Promise<Proveedor | null>;
  abstract listar(filtros: FiltrosProveedor): Promise<PaginaResultado<Proveedor>>;
}
