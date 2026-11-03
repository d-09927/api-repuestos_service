import { Injectable } from '@nestjs/common';
import { RepuestosService } from '../../../repuestos/application/repuestos.service';
import { RepuestoDeCodigo, RepuestoServicePort } from '../../domain/ports/repuesto.service.port';

/** ADAPTADOR "local": consulta el catálogo con el service que exporta el módulo de repuestos. */
@Injectable()
export class RepuestoLocalAdapter extends RepuestoServicePort {
  constructor(private readonly repuestos: RepuestosService) {
    super();
  }

  async porCodigoUniversal(codigo: string): Promise<RepuestoDeCodigo[]> {
    const pagina = await this.repuestos.listar({ codigoUniversal: codigo, pagina: 1, limite: 50 });
    return pagina.items.map(({ repuesto: r }) => ({ id: r.id, sku: r.sku, nombre: r.nombre, precio: r.precio }));
  }
}
