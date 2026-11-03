import { Injectable } from '@nestjs/common';
import { VentasService } from '../../../ventas/application/ventas.service';
import { VentaDelPedido } from '../../domain/entities/pedido.entity';
import { VentaPorCobrar, VentaServicePort } from '../../domain/ports/venta.service.port';

/** ADAPTADOR "local": registra la venta con el service que exporta el módulo de ventas. */
@Injectable()
export class VentaLocalAdapter extends VentaServicePort {
  constructor(private readonly ventas: VentasService) {
    super();
  }

  async registrarPorCobrar(v: VentaPorCobrar): Promise<VentaDelPedido> {
    const { venta } = await this.ventas.registrar(v, { pendienteDePago: true, desdeReserva: true });
    return { id: venta.id, numero: venta.numero, bodega: venta.bodega, total: venta.total };
  }

  async marcarPagada(ventaId: string, referenciaPago: string): Promise<void> {
    await this.ventas.marcarPagada(ventaId, referenciaPago);
  }
}
