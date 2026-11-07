import { Llamante } from '../../domain/enums/llamante.enum';

export interface RegistrarLlamadaCommand {
  llamante: Llamante;
  herramienta: string;
  argumentos?: Record<string, unknown> | null;
  resultado?: string | null;
  esError: boolean;
  duracionMs: number;
}
