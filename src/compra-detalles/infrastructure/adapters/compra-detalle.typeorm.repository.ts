import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { repoActual } from '../../../common/unidad-de-trabajo/transaccion-actual';
import { CompraDetalle } from '../../domain/entities/compra-detalle.entity';
import { CompraDetalleRepositoryPort } from '../../domain/ports/compra-detalle.repository.port';
import { CompraDetalleOrmEntity } from '../entities/compra-detalle.orm-entity';

/** ADAPTADOR de salida: implementa CompraDetalleRepositoryPort con TypeORM + Postgres. */
@Injectable()
export class CompraDetalleTypeOrmRepository extends CompraDetalleRepositoryPort {
  constructor(
    @InjectRepository(CompraDetalleOrmEntity)
    private readonly base: Repository<CompraDetalleOrmEntity>,
  ) {
    super();
  }

  async guardarVarios(detalles: CompraDetalle[]): Promise<void> {
    if (!detalles.length) return;
    await repoActual(this.base).insert(detalles.map((d) => ({ ...d })));
  }

  async listarPorCompras(compraIds: string[]): Promise<CompraDetalle[]> {
    if (!compraIds.length) return [];
    const filas = await repoActual(this.base).find({ where: { compraId: In(compraIds) } });
    return filas.map((f) => new CompraDetalle({ ...f }));
  }
}
