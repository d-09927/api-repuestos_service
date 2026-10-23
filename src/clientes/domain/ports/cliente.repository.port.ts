import { PaginaResultado } from '../../../common/paginacion';
import { Cliente } from '../entities/cliente.entity';
import { TipoDocumento } from '../enums/tipo-documento.enum';

export interface FiltrosCliente {
  texto?: string;
  incluirInactivos?: boolean;
  pagina: number;
  limite: number;
}

/** PUERTO de salida: guardar y leer clientes. La implementación vive en infrastructure/adapters. */
export abstract class ClienteRepositoryPort {
  abstract guardar(cliente: Cliente): Promise<void>;
  abstract buscarPorId(id: string): Promise<Cliente | null>;
  abstract buscarPorDocumento(tipo: TipoDocumento, documento: string): Promise<Cliente | null>;
  abstract listar(filtros: FiltrosCliente): Promise<PaginaResultado<Cliente>>;
}
