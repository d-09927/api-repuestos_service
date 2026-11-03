import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { ConflictError } from '../../../common/domain-error';
import { Pedido } from '../../domain/entities/pedido.entity';
import { EstadoPedido } from '../../domain/enums/estado-pedido.enum';
import { PedidoRepositoryPort } from '../../domain/ports/pedido.repository.port';
import { PedidoOrmEntity } from '../entities/pedido.orm-entity';

/** ADAPTADOR de salida: implementa PedidoRepositoryPort con TypeORM + Postgres. */
@Injectable()
export class PedidoTypeOrmRepository extends PedidoRepositoryPort {
  constructor(
    @InjectRepository(PedidoOrmEntity)
    private readonly orm: Repository<PedidoOrmEntity>,
  ) {
    super();
  }

  async guardar(pedido: Pedido): Promise<void> {
    try {
      await this.orm.save(Object.assign(new PedidoOrmEntity(), { ...pedido }));
    } catch (error) {
      if (error instanceof QueryFailedError && (error.driverError as { code?: string })?.code === '23505') {
        throw new ConflictError(`La orden ${pedido.codigoOrden} ya tiene un pedido`);
      }
      throw error;
    }
  }

  async buscarPorCodigoOrden(codigoOrden: string): Promise<Pedido | null> {
    const fila = await this.orm.findOne({ where: { codigoOrden } });
    return fila ? this.aDominio(fila) : null;
  }

  async listar(estado?: EstadoPedido): Promise<Pedido[]> {
    const filas = await this.orm.find({ where: estado ? { estado } : {}, order: { actualizadoEn: 'DESC' }, take: 100 });
    return filas.map((f) => this.aDominio(f));
  }

  private aDominio(f: PedidoOrmEntity): Pedido {
    return new Pedido({
      id: f.id,
      codigoOrden: f.codigoOrden,
      estado: f.estado as EstadoPedido,
      lineas: f.lineas,
      ventas: f.ventas,
      mensajes: f.mensajes,
      referenciaPago: f.referenciaPago,
      creadoEn: f.creadoEn,
      actualizadoEn: f.actualizadoEn,
    });
  }
}
