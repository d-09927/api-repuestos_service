import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { repoActual } from '../../../common/unidad-de-trabajo/transaccion-actual';
import { StockItem } from '../../domain/entities/stock-item.entity';
import { StockConcurrenteError } from '../../domain/errors/stock-concurrente.error';
import { StockRepositoryPort } from '../../domain/ports/stock.repository.port';
import { StockOrmEntity } from '../entities/stock.orm-entity';

const UNIQUE_VIOLATION = '23505';

/** ADAPTADOR de salida: implementa StockRepositoryPort con TypeORM + Postgres. */
@Injectable()
export class StockTypeOrmRepository extends StockRepositoryPort {
  constructor(
    @InjectRepository(StockOrmEntity)
    private readonly base: Repository<StockOrmEntity>,
  ) {
    super();
  }

  async bloquear(repuestoId: string, bodega: string): Promise<StockItem | null> {
    // pessimistic_write = SELECT ... FOR UPDATE: nadie más modifica esta fila hasta el commit.
    const fila = await repoActual(this.base).findOne({
      where: { repuestoId, bodega },
      lock: { mode: 'pessimistic_write' },
    });
    return fila ? this.aDominio(fila) : null;
  }

  async bloquearVarios(bodega: string, repuestoIds: string[]): Promise<Map<string, StockItem | null>> {
    const actuales = new Map<string, StockItem | null>();
    // Siempre en el mismo orden para que dos lotes simultáneos no se queden esperándose.
    for (const repuestoId of [...new Set(repuestoIds)].sort()) {
      actuales.set(repuestoId, await this.bloquear(repuestoId, bodega));
    }
    return actuales;
  }

  async guardar(stock: StockItem): Promise<void> {
    try {
      await repoActual(this.base).save(
        Object.assign(new StockOrmEntity(), {
          id: stock.id,
          repuestoId: stock.repuestoId,
          bodega: stock.bodega,
          cantidad: stock.cantidad,
          reservada: stock.reservada,
          minimo: stock.minimo,
          ubicacion: stock.ubicacion,
          actualizadoEn: stock.actualizadoEn,
        }),
      );
    } catch (error) {
      if (error instanceof QueryFailedError && (error.driverError as { code?: string })?.code === UNIQUE_VIOLATION) {
        throw new StockConcurrenteError('Otra operación creó el stock al mismo tiempo; intenta de nuevo');
      }
      throw error;
    }
  }

  async listarPorRepuesto(repuestoId: string): Promise<StockItem[]> {
    const filas = await repoActual(this.base).find({ where: { repuestoId }, order: { bodega: 'ASC' } });
    return filas.map((f) => this.aDominio(f));
  }

  async listarBajoMinimo(): Promise<StockItem[]> {
    const filas = await repoActual(this.base)
      .createQueryBuilder('s')
      .where('s.cantidad - s.reservada <= s.minimo')
      .orderBy('s.actualizadoEn', 'DESC')
      .getMany();
    return filas.map((f) => this.aDominio(f));
  }

  private aDominio(f: StockOrmEntity): StockItem {
    return new StockItem({
      id: f.id,
      repuestoId: f.repuestoId,
      bodega: f.bodega,
      cantidad: f.cantidad,
      reservada: f.reservada,
      minimo: f.minimo,
      ubicacion: f.ubicacion,
      actualizadoEn: f.actualizadoEn,
    });
  }
}
