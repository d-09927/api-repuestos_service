import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { conTransaccion, transaccionActual } from './transaccion-actual';
import { UnidadDeTrabajoPort } from './unidad-de-trabajo.port';

/** ADAPTADOR: transacciones de Postgres con TypeORM. Si ya hay una abierta, la reutiliza. */
@Injectable()
export class UnidadDeTrabajoTypeOrm extends UnidadDeTrabajoPort {
  constructor(private readonly dataSource: DataSource) {
    super();
  }

  ejecutar<T>(trabajo: () => Promise<T>): Promise<T> {
    if (transaccionActual()) return trabajo();
    return this.dataSource.transaction((manager) => conTransaccion(manager, trabajo));
  }
}
