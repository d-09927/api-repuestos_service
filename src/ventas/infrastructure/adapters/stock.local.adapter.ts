import { Injectable } from '@nestjs/common';
import { StockService } from '../../../stock/application/stock.service';
import { MovimientoDeVenta, StockServicePort } from '../../domain/ports/stock.service.port';

/** ADAPTADOR "local": mueve el stock usando el service que exporta el módulo de stock. */
@Injectable()
export class StockLocalAdapter extends StockServicePort {
  constructor(private readonly stock: StockService) {
    super();
  }

  descontarMercancia(m: MovimientoDeVenta): Promise<void> {
    return this.stock.registrarSalidas({ ...m, motivo: 'Venta' });
  }

  revertirDescuento(m: MovimientoDeVenta): Promise<void> {
    return this.stock.registrarEntradas({ ...m, motivo: 'Reversión: la venta no pudo guardarse' });
  }
}
