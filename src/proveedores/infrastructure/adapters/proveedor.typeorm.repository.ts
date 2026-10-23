import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { ConflictError } from '../../../common/domain-error';
import { PaginaResultado } from '../../../common/paginacion';
import { Proveedor } from '../../domain/entities/proveedor.entity';
import {
  FiltrosProveedor,
  ProveedorRepositoryPort,
} from '../../domain/ports/proveedor.repository.port';
import { ProveedorOrmEntity } from '../entities/proveedor.orm-entity';

/** ADAPTADOR de salida: implementa ProveedorRepositoryPort con TypeORM + Postgres. */
@Injectable()
export class ProveedorTypeOrmRepository extends ProveedorRepositoryPort {
  constructor(
    @InjectRepository(ProveedorOrmEntity)
    private readonly orm: Repository<ProveedorOrmEntity>,
  ) {
    super();
  }

  async guardar(proveedor: Proveedor): Promise<void> {
    try {
      await this.orm.save(Object.assign(new ProveedorOrmEntity(), { ...proveedor }));
    } catch (error) {
      if (error instanceof QueryFailedError && (error.driverError as { code?: string })?.code === '23505') {
        throw new ConflictError(`Ya existe un proveedor con el NIT ${proveedor.nit}`);
      }
      throw error;
    }
  }

  async buscarPorId(id: string): Promise<Proveedor | null> {
    const fila = await this.orm.findOne({ where: { id } });
    return fila ? this.aDominio(fila) : null;
  }

  async buscarPorNit(nit: string): Promise<Proveedor | null> {
    const fila = await this.orm.findOne({ where: { nit } });
    return fila ? this.aDominio(fila) : null;
  }

  async listar(f: FiltrosProveedor): Promise<PaginaResultado<Proveedor>> {
    const qb = this.orm.createQueryBuilder('p');
    if (!f.incluirInactivos) qb.andWhere('p.activo = true');
    if (f.texto) {
      const patron = `%${f.texto.replace(/[\\%_]/g, '\\$&')}%`;
      qb.andWhere('(p.nombre ILIKE :patron OR p.nit ILIKE :patron OR p.contacto ILIKE :patron)', { patron });
    }
    qb.orderBy('p.nombre', 'ASC')
      .skip((f.pagina - 1) * f.limite)
      .take(f.limite);

    const [filas, total] = await qb.getManyAndCount();
    return { items: filas.map((fila) => this.aDominio(fila)), total, pagina: f.pagina, limite: f.limite };
  }

  private aDominio(f: ProveedorOrmEntity): Proveedor {
    return new Proveedor({
      id: f.id,
      nit: f.nit,
      nombre: f.nombre,
      contacto: f.contacto,
      telefono: f.telefono,
      email: f.email,
      direccion: f.direccion,
      activo: f.activo,
      creadoEn: f.creadoEn,
      actualizadoEn: f.actualizadoEn,
    });
  }
}
