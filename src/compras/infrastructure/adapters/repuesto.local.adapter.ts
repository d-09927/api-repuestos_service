import { Injectable } from '@nestjs/common';
import { RepuestosService } from '../../../repuestos/application/repuestos.service';
import { RepuestoInfo, RepuestoServicePort } from '../../domain/ports/repuesto.service.port';

/** ADAPTADOR "local": le pregunta al service del módulo de repuestos (mismo proceso). */
@Injectable()
export class RepuestoLocalAdapter extends RepuestoServicePort {
  constructor(private readonly repuestos: RepuestosService) {
    super();
  }

  async obtenerActivos(repuestoIds: string[]): Promise<RepuestoInfo[]> {
    const unicos = [...new Set(repuestoIds)];
    return Promise.all(
      unicos.map(async (id) => {
        const repuesto = await this.repuestos.verificarActivo(id);
        return { id: repuesto.id, sku: repuesto.sku, nombre: repuesto.nombre };
      }),
    );
  }
}
