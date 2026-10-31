import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { ConflictError } from '../../../common/domain-error';
import { PaginaResultado } from '../../../common/paginacion';
import { repoActual } from '../../../common/unidad-de-trabajo/transaccion-actual';
import { Repuesto } from '../../domain/entities/repuesto.entity';
import {
  FiltrosRepuesto,
  RepuestoRepositoryPort,
} from '../../domain/ports/repuesto.repository.port';
import { RepuestoOrmEntity } from '../entities/repuesto.orm-entity';

/** ADAPTADOR de salida: implementa RepuestoRepositoryPort con TypeORM + Postgres. */
@Injectable()
export class RepuestoTypeOrmRepository extends RepuestoRepositoryPort {
  constructor(
    @InjectRepository(RepuestoOrmEntity)
    private readonly base: Repository<RepuestoOrmEntity>,
  ) {
    super();
  }

  async guardar(repuesto: Repuesto): Promise<void> {
    try {
      await repoActual(this.base).save(Object.assign(new RepuestoOrmEntity(), { ...repuesto }));
    } catch (error) {
      if (error instanceof QueryFailedError && (error.driverError as { code?: string })?.code === '23505') {
        throw new ConflictError(`Ya existe un repuesto con el SKU ${repuesto.sku}`);
      }
      throw error;
    }
  }

  async buscarPorId(id: string): Promise<Repuesto | null> {
    const fila = await repoActual(this.base).findOne({ where: { id } });
    return fila ? this.aDominio(fila) : null;
  }

  async buscarPorSku(sku: string): Promise<Repuesto | null> {
    const fila = await repoActual(this.base).findOne({ where: { sku } });
    return fila ? this.aDominio(fila) : null;
  }

  async listar(f: FiltrosRepuesto): Promise<PaginaResultado<Repuesto>> {
    const qb = repoActual(this.base).createQueryBuilder('r');

    if (!f.incluirInactivos) qb.andWhere('r.activo = true');
    if (f.ids) qb.andWhere('r.id IN (:...ids)', { ids: f.ids });

    if (f.texto) {
      const patron = `%${f.texto.replace(/[\\%_]/g, '\\$&')}%`;
      qb.andWhere('(r.nombre ILIKE :patron OR r.sku ILIKE :patron OR r.codigoUniversal ILIKE :patron OR r.descripcion ILIKE :patron)', { patron });
    }
    if (f.codigoUniversal) qb.andWhere('r.codigoUniversal = :codigo', { codigo: f.codigoUniversal.trim().toUpperCase() });
    if (f.marca) qb.andWhere('LOWER(r.marca) = LOWER(:marca)', { marca: f.marca });
    if (f.categoria) qb.andWhere('LOWER(r.categoria) = LOWER(:categoria)', { categoria: f.categoria });

    qb.orderBy('r.nombre', 'ASC')
      .skip((f.pagina - 1) * f.limite)
      .take(f.limite);

    const [filas, total] = await qb.getManyAndCount();
    return { items: filas.map((fila) => this.aDominio(fila)), total, pagina: f.pagina, limite: f.limite };
  }

  private aDominio(f: RepuestoOrmEntity): Repuesto {
    return new Repuesto({
      id: f.id,
      sku: f.sku,
      codigoUniversal: f.codigoUniversal,
      nombre: f.nombre,
      descripcion: f.descripcion,
      marca: f.marca,
      categoria: f.categoria,
      precio: f.precio,
      activo: f.activo,
      creadoEn: f.creadoEn,
      actualizadoEn: f.actualizadoEn,
    });
  }
}
