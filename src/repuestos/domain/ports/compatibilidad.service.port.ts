export interface CompatibilidadInfo {
  repuestoId: string;
  marca: string;
  modelo: string;
  anioDesde: number;
  anioHasta: number;
}

/** PUERTO hacia el módulo de compatibilidades (otra tabla). */
export abstract class CompatibilidadServicePort {
  abstract reemplazar(
    repuestoId: string,
    lista: Omit<CompatibilidadInfo, 'repuestoId'>[],
  ): Promise<CompatibilidadInfo[]>;
  abstract listarPorRepuestos(repuestoIds: string[]): Promise<CompatibilidadInfo[]>;
  abstract repuestoIdsPorVehiculo(vehiculo: {
    marca: string;
    modelo: string;
    anio?: number;
  }): Promise<string[]>;
}
