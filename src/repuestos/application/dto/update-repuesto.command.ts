import { CompatibilidadCommand } from './create-repuesto.command';

export interface UpdateRepuestoCommand {
  nombre?: string;
  descripcion?: string;
  marca?: string;
  categoria?: string;
  precio?: number;
  /** Si viene, reemplaza la lista completa de compatibilidades. */
  compatibilidad?: CompatibilidadCommand[];
}
