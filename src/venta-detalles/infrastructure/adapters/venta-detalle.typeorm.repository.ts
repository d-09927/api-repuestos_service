import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { repoActual } from '../../../common/unidad-de-trabajo/transaccion-actual';
import { VentaDetalle } from '../../domain/entities/venta-detalle.entity';
import { VentaDetalleRepositoryPort } from '../../domain/ports/venta-detalle.repository.port';
import { VentaDetalleOrmEntity } from '../entities/venta-detalle.orm-entity';

/** ADAPTADOR de salida: implementa VentaDetalleRepositoryPort con TypeORM + Postgres. */
@Injectable()
export class VentaDetalleTypeOrmRepository extends VentaDetalleRepositoryPort {
  constructor(
    @InjectRepository(VentaDetalleOrmEntity)
    private readonly base: Repository<VentaDetalleOrmEntity>,
  ) {
    super();
  }

  async guardarVarios(detalles: VentaDetalle[]): Promise<void> {
    if (!detalles.length) return;
    await repoActual(this.base).insert(detalles.map((d) => ({ ...d })));
  }

  async listarPorVentas(ventaIds: string[]): Promise<VentaDetalle[]> {
    if (!ventaIds.length) return [];
    const filas = await repoActual(this.base).find({ where: { ventaId: In(ventaIds) } });
    return filas.map((f) => new VentaDetalle({ ...f }));
  }
}
