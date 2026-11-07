import { Llamante } from '../enums/llamante.enum';

/** Entidad de dominio: una llamada a una herramienta del MCP, con lo que respondió. */
export class LlamadaMcp {
  id: string;
  llamante: Llamante;
  herramienta: string;
  argumentos: Record<string, unknown>;
  /** Texto que devolvió la herramienta (JSON o mensaje de error), recortado si es muy largo. */
  resultado: string | null;
  esError: boolean;
  duracionMs: number;
  creadoEn: Date;

  constructor(datos: LlamadaMcp) {
    Object.assign(this, datos);
  }
}
