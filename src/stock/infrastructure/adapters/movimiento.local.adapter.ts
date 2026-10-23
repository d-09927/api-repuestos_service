import { Injectable } from '@nestjs/common';
import { MovimientosService } from '../../../movimientos/application/movimientos.service';
import { TipoMovimiento } from '../../../movimientos/domain/enums/tipo-movimiento.enum';
import { MovimientoServicePort, RegistroMovimiento } from '../../domain/ports/movimiento.service.port';

/** ADAPTADOR "local": registra en el módulo de movimientos (mismo proceso). */
@Injectable()
export class MovimientoLocalAdapter extends MovimientoServicePort {
  constructor(private readonly movimientos: MovimientosService) {
    super();
  }

  registrar(movimientos: RegistroMovimiento[]): Promise<void> {
    return this.movimientos.registrar(
      movimientos.map((m) => ({ ...m, tipo: m.tipo as TipoMovimiento })),
    );
  }
}
