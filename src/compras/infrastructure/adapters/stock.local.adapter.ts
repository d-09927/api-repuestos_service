import { Injectable } from '@nestjs/common';
import { StockService } from '../../../stock/application/stock.service';
import { MovimientoDeCompra, StockServicePort } from '../../domain/ports/stock.service.port';

/** ADAPTADOR "local": mueve el stock usando el service que exporta el módulo de stock. */
@Injectable()
export class StockLocalAdapter extends StockServicePort {
  constructor(private readonly stock: StockService) {
    super();
  }

  ingresarMercancia(m: MovimientoDeCompra): Promise<void> {
    return this.stock.registrarEntradas({ ...m, motivo: 'Compra' });
  }

  revertirIngreso(m: MovimientoDeCompra): Promise<void> {
    return this.stock.registrarSalidas({ ...m, motivo: 'Reversión: la compra no pudo guardarse' });
  }
}
