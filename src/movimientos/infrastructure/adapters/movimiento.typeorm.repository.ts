import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginaResultado } from '../../../common/paginacion';
import { repoActual } from '../../../common/unidad-de-trabajo/transaccion-actual';
import { Movimiento } from '../../domain/entities/movimiento.entity';
import { TipoMovimiento } from '../../domain/enums/tipo-movimiento.enum';
import {
  FiltrosMovimientos,
  MovimientoRepositoryPort,
} from '../../domain/ports/movimiento.repository.port';
import { MovimientoOrmEntity } from '../entities/movimiento.orm-entity';

/** ADAPTADOR de salida: implementa MovimientoRepositoryPort con TypeORM + Postgres. */
@Injectable()
export class MovimientoTypeOrmRepository extends MovimientoRepositoryPort {
  constructor(
    @InjectRepository(MovimientoOrmEntity)
    private readonly base: Repository<MovimientoOrmEntity>,
  ) {
    super();
  }

  async guardarVarios(movimientos: Movimiento[]): Promise<void> {
    if (!movimientos.length) return;
    await repoActual(this.base).insert(movimientos.map((m) => ({ ...m })));
  }

  async listar(f: FiltrosMovimientos): Promise<PaginaResultado<Movimiento>> {
    const [filas, total] = await repoActual(this.base).findAndCount({
      where: {
        ...(f.repuestoId ? { repuestoId: f.repuestoId } : {}),
        ...(f.bodega ? { bodega: f.bodega } : {}),
      },
      order: { creadoEn: 'DESC' },
      skip: (f.pagina - 1) * f.limite,
      take: f.limite,
    });
    return {
      items: filas.map((m) => new Movimiento({ ...m, tipo: m.tipo as TipoMovimiento })),
      total,
      pagina: f.pagina,
      limite: f.limite,
    };
  }
}
