import { PaginaResultado } from '../../../common/paginacion';
import { LlamadaMcp } from '../entities/llamada-mcp.entity';
import { Llamante } from '../enums/llamante.enum';

export interface FiltrosBitacora {
  herramienta?: string;
  llamante?: Llamante;
  soloErrores?: boolean;
  desde?: Date;
  hasta?: Date;
  pagina: number;
  limite: number;
}

/** PUERTO de salida: guardar y leer la bitácora del MCP. */
export abstract class LlamadaMcpRepositoryPort {
  abstract guardar(llamada: LlamadaMcp): Promise<void>;
  abstract listar(filtros: FiltrosBitacora): Promise<PaginaResultado<LlamadaMcp>>;
}
