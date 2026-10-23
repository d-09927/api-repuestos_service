import { Compatibilidad } from '../entities/compatibilidad.entity';

export interface VehiculoBuscado {
  marca: string;
  modelo: string;
  anio?: number;
}

/** PUERTO de salida: guardar y leer compatibilidades. */
export abstract class CompatibilidadRepositoryPort {
  /** Deja exactamente `lista` como compatibilidades del repuesto (borra las anteriores). */
  abstract reemplazarDeRepuesto(repuestoId: string, lista: Compatibilidad[]): Promise<void>;
  abstract listarPorRepuestos(repuestoIds: string[]): Promise<Compatibilidad[]>;
  abstract repuestoIdsPorVehiculo(vehiculo: VehiculoBuscado): Promise<string[]>;
}
