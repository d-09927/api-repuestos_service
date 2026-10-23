import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { ConflictError } from '../../../common/domain-error';
import { PaginaResultado } from '../../../common/paginacion';
import { Cliente } from '../../domain/entities/cliente.entity';
import { TipoDocumento } from '../../domain/enums/tipo-documento.enum';
import {
  ClienteRepositoryPort,
  FiltrosCliente,
} from '../../domain/ports/cliente.repository.port';
import { ClienteOrmEntity } from '../entities/cliente.orm-entity';

/** ADAPTADOR de salida: implementa ClienteRepositoryPort con TypeORM + Postgres. */
@Injectable()
export class ClienteTypeOrmRepository extends ClienteRepositoryPort {
  constructor(
    @InjectRepository(ClienteOrmEntity)
    private readonly orm: Repository<ClienteOrmEntity>,
  ) {
    super();
  }

  async guardar(cliente: Cliente): Promise<void> {
    try {
      await this.orm.save(Object.assign(new ClienteOrmEntity(), { ...cliente }));
    } catch (error) {
      if (error instanceof QueryFailedError && (error.driverError as { code?: string })?.code === '23505') {
        throw new ConflictError(`Ya existe un cliente con ${cliente.tipoDocumento} ${cliente.documento}`);
      }
      throw error;
    }
  }

  async buscarPorId(id: string): Promise<Cliente | null> {
    const fila = await this.orm.findOne({ where: { id } });
    return fila ? this.aDominio(fila) : null;
  }

  async buscarPorDocumento(tipo: TipoDocumento, documento: string): Promise<Cliente | null> {
    const fila = await this.orm.findOne({
      where: { tipoDocumento: tipo, documento },
    });
    return fila ? this.aDominio(fila) : null;
  }

  async listar(f: FiltrosCliente): Promise<PaginaResultado<Cliente>> {
    const qb = this.orm.createQueryBuilder('c');
    if (!f.incluirInactivos) qb.andWhere('c.activo = true');
    if (f.texto) {
      const patron = `%${f.texto.replace(/[\\%_]/g, '\\$&')}%`;
      qb.andWhere('(c.nombre ILIKE :patron OR c.documento ILIKE :patron OR c.email ILIKE :patron)', { patron });
    }
    qb.orderBy('c.nombre', 'ASC')
      .skip((f.pagina - 1) * f.limite)
      .take(f.limite);

    const [filas, total] = await qb.getManyAndCount();
    return { items: filas.map((fila) => this.aDominio(fila)), total, pagina: f.pagina, limite: f.limite };
  }

  private aDominio(f: ClienteOrmEntity): Cliente {
    return new Cliente({
      id: f.id,
      tipoDocumento: f.tipoDocumento as TipoDocumento,
      documento: f.documento,
      nombre: f.nombre,
      telefono: f.telefono,
      email: f.email,
      direccion: f.direccion,
      activo: f.activo,
      creadoEn: f.creadoEn,
      actualizadoEn: f.actualizadoEn,
    });
  }
}
