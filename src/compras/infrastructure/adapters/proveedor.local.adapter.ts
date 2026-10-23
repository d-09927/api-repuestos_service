import { Injectable } from '@nestjs/common';
import { ProveedoresService } from '../../../proveedores/application/proveedores.service';
import { ProveedorServicePort } from '../../domain/ports/proveedor.service.port';

/** ADAPTADOR "local": le pregunta al service del módulo de proveedores (mismo proceso). */
@Injectable()
export class ProveedorLocalAdapter extends ProveedorServicePort {
  constructor(private readonly proveedores: ProveedoresService) {
    super();
  }

  async verificarProveedorActivo(proveedorId: string): Promise<void> {
    await this.proveedores.verificarActivo(proveedorId);
  }
}
