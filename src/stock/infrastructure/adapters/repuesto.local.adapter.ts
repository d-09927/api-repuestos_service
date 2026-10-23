import { Injectable } from '@nestjs/common';
import { RepuestosService } from '../../../repuestos/application/repuestos.service';
import { RepuestoServicePort } from '../../domain/ports/repuesto.service.port';

/** ADAPTADOR "local": le pregunta al service del módulo de repuestos (mismo proceso). */
@Injectable()
export class RepuestoLocalAdapter extends RepuestoServicePort {
  constructor(private readonly repuestos: RepuestosService) {
    super();
  }

  async verificarRepuestoActivo(repuestoId: string): Promise<void> {
    await this.repuestos.verificarActivo(repuestoId);
  }
}
