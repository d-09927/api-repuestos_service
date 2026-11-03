import { Injectable } from '@nestjs/common';
import { StockService } from '../../../stock/application/stock.service';
import { MovimientoDePedido, StockServicePort } from '../../domain/ports/stock.service.port';

/** ADAPTADOR "local": mueve el stock con el service que exporta el módulo de stock. */
@Injectable()
export class StockLocalAdapter extends StockServicePort {
  constructor(private readonly stock: StockService) {
    super();
  }

  async disponiblePorBodega(repuestoId: string) {
    const { bodegas } = await this.stock.consultarPorRepuesto(repuestoId);
    return bodegas.map((b) => ({ bodega: b.bodega, disponible: this.stock.disponible(b) }));
  }

  reservar(m: MovimientoDePedido): Promise<void> {
    return this.stock.reservarVarios({ ...m, motivo: 'Pedido de orden de taller' });
  }

  liberar(m: MovimientoDePedido): Promise<void> {
    return this.stock.liberarVarios({ ...m, motivo: 'Liberación de pedido de orden de taller' });
  }
}
