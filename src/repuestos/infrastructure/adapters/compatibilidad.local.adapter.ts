import { Injectable } from '@nestjs/common';
import { CompatibilidadesService } from '../../../compatibilidades/application/compatibilidades.service';
import {
  CompatibilidadInfo,
  CompatibilidadServicePort,
} from '../../domain/ports/compatibilidad.service.port';

/** ADAPTADOR: habla con el módulo de compatibilidades dentro del mismo proceso. */
@Injectable()
export class CompatibilidadLocalAdapter extends CompatibilidadServicePort {
  constructor(private readonly compatibilidades: CompatibilidadesService) {
    super();
  }

  async reemplazar(
    repuestoId: string,
    lista: Omit<CompatibilidadInfo, 'repuestoId'>[],
  ): Promise<CompatibilidadInfo[]> {
    return this.compatibilidades.reemplazar(repuestoId, lista);
  }

  listarPorRepuestos(repuestoIds: string[]): Promise<CompatibilidadInfo[]> {
    return this.compatibilidades.listarPorRepuestos(repuestoIds);
  }

  repuestoIdsPorVehiculo(vehiculo: { marca: string; modelo: string; anio?: number }): Promise<string[]> {
    return this.compatibilidades.repuestoIdsPorVehiculo(vehiculo);
  }
}
