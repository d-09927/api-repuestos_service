import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, FindOptionsWhere, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { PaginaResultado } from '../../../common/paginacion';
import { LlamadaMcp } from '../../domain/entities/llamada-mcp.entity';
import { Llamante } from '../../domain/enums/llamante.enum';
import { FiltrosBitacora, LlamadaMcpRepositoryPort } from '../../domain/ports/llamada-mcp.repository.port';
import { LlamadaMcpOrmEntity } from '../entities/llamada-mcp.orm-entity';

/** ADAPTADOR de salida: implementa LlamadaMcpRepositoryPort con TypeORM + Postgres. */
@Injectable()
export class LlamadaMcpTypeOrmRepository extends LlamadaMcpRepositoryPort {
  constructor(
    @InjectRepository(LlamadaMcpOrmEntity)
    private readonly base: Repository<LlamadaMcpOrmEntity>,
  ) {
    super();
  }

  async guardar(llamada: LlamadaMcp): Promise<void> {
    // Fuera de cualquier transacción: el registro queda aunque la operación de la herramienta falle.
    // El cast es por la columna jsonb, que TypeORM no tipa bien en insert.
    await this.base.insert({ ...llamada } as QueryDeepPartialEntity<LlamadaMcpOrmEntity>);
  }

  async listar(f: FiltrosBitacora): Promise<PaginaResultado<LlamadaMcp>> {
    const where: FindOptionsWhere<LlamadaMcpOrmEntity> = {};
    if (f.herramienta) where.herramienta = f.herramienta;
    if (f.llamante) where.llamante = f.llamante;
    if (f.soloErrores) where.esError = true;
    if (f.desde && f.hasta) where.creadoEn = Between(f.desde, f.hasta);
    else if (f.desde) where.creadoEn = MoreThanOrEqual(f.desde);
    else if (f.hasta) where.creadoEn = LessThanOrEqual(f.hasta);

    const [filas, total] = await this.base.findAndCount({
      where,
      order: { creadoEn: 'DESC' },
      skip: (f.pagina - 1) * f.limite,
      take: f.limite,
    });
    return {
      items: filas.map((l) => new LlamadaMcp({ ...l, llamante: l.llamante as Llamante })),
      total,
      pagina: f.pagina,
      limite: f.limite,
    };
  }
}
