import { Injectable } from '@nestjs/common';
import { RepuestosService } from '../../../repuestos/application/repuestos.service';
import { RepuestoDelCatalogo, RepuestoServicePort } from '../../domain/ports/repuesto.service.port';

/** ADAPTADOR "local": le pregunta al service del módulo de repuestos (mismo proceso). */
@Injectable()
export class RepuestoLocalAdapter extends RepuestoServicePort {
  constructor(private readonly repuestos: RepuestosService) {
    super();
  }

  async verificarRepuestoActivo(repuestoId: string): Promise<void> {
    await this.repuestos.verificarActivo(repuestoId);
  }

  async activosPorIds(repuestoIds: string[]): Promise<RepuestoDelCatalogo[]> {
    return (await this.repuestos.activosPorIds(repuestoIds)).map((r) => ({
      id: r.id,
      codigoUniversal: r.codigoUniversal,
      nombre: r.nombre,
      marca: r.marca,
      categoria: r.categoria,
      precio: r.precio,
    }));
  }
}
