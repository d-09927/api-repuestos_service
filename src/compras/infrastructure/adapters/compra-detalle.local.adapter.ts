import { Injectable } from '@nestjs/common';
import { CompraDetallesService } from '../../../compra-detalles/application/compra-detalles.service';
import {
  CompraDetalleServicePort,
  DetalleCompraInfo,
  LineaCompraInfo,
} from '../../domain/ports/compra-detalle.service.port';

/** ADAPTADOR "local": habla con el módulo de compra-detalles (mismo proceso). */
@Injectable()
export class CompraDetalleLocalAdapter extends CompraDetalleServicePort {
  constructor(private readonly detalles: CompraDetallesService) {
    super();
  }

  construir(lineas: LineaCompraInfo[]): DetalleCompraInfo[] {
    return this.detalles.construir(lineas);
  }

  guardar(detalles: DetalleCompraInfo[]): Promise<void> {
    return this.detalles.guardar(detalles);
  }

  listarPorCompras(compraIds: string[]): Promise<DetalleCompraInfo[]> {
    return this.detalles.listarPorCompras(compraIds);
  }
}
