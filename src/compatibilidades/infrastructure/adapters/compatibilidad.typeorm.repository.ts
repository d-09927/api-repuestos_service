import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { repoActual } from '../../../common/unidad-de-trabajo/transaccion-actual';
import { Compatibilidad } from '../../domain/entities/compatibilidad.entity';
import {
  CompatibilidadRepositoryPort,
  VehiculoBuscado,
} from '../../domain/ports/compatibilidad.repository.port';
import { CompatibilidadOrmEntity } from '../entities/compatibilidad.orm-entity';

/** ADAPTADOR de salida: implementa CompatibilidadRepositoryPort con TypeORM + Postgres. */
@Injectable()
export class CompatibilidadTypeOrmRepository extends CompatibilidadRepositoryPort {
  constructor(
    @InjectRepository(CompatibilidadOrmEntity)
    private readonly base: Repository<CompatibilidadOrmEntity>,
  ) {
    super();
  }

  async reemplazarDeRepuesto(repuestoId: string, lista: Compatibilidad[]): Promise<void> {
    const orm = repoActual(this.base);
    await orm.delete({ repuestoId });
    if (lista.length) await orm.insert(lista.map((c) => ({ ...c })));
  }

  async listarPorRepuestos(repuestoIds: string[]): Promise<Compatibilidad[]> {
    if (!repuestoIds.length) return [];
    const filas = await repoActual(this.base).find({
      where: { repuestoId: In(repuestoIds) },
      order: { marca: 'ASC', modelo: 'ASC', anioDesde: 'ASC' },
    });
    return filas.map((f) => new Compatibilidad({ ...f }));
  }

  async repuestoIdsPorVehiculo(v: VehiculoBuscado): Promise<string[]> {
    const qb = repoActual(this.base)
      .createQueryBuilder('c')
      .select('DISTINCT c."repuestoId"', 'repuestoId')
      .where('LOWER(c.marca) = LOWER(:marca)', { marca: v.marca })
      .andWhere('LOWER(c.modelo) = LOWER(:modelo)', { modelo: v.modelo });
    if (v.anio !== undefined) {
      qb.andWhere('c."anioDesde" <= :anio AND c."anioHasta" >= :anio', { anio: v.anio });
    }
    const filas = await qb.getRawMany<{ repuestoId: string }>();
    return filas.map((f) => f.repuestoId);
  }
}
