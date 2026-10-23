import { Injectable } from '@nestjs/common';
import { VentaDetallesService } from '../../../venta-detalles/application/venta-detalles.service';
import {
  DetalleVentaInfo,
  LineaVentaInfo,
  VentaDetalleServicePort,
} from '../../domain/ports/venta-detalle.service.port';

/** ADAPTADOR "local": habla con el módulo de venta-detalles (mismo proceso). */
@Injectable()
export class VentaDetalleLocalAdapter extends VentaDetalleServicePort {
  constructor(private readonly detalles: VentaDetallesService) {
    super();
  }

  construir(lineas: LineaVentaInfo[]): DetalleVentaInfo[] {
    return this.detalles.construir(lineas);
  }

  guardar(detalles: DetalleVentaInfo[]): Promise<void> {
    return this.detalles.guardar(detalles);
  }

  listarPorVentas(ventaIds: string[]): Promise<DetalleVentaInfo[]> {
    return this.detalles.listarPorVentas(ventaIds);
  }
}
