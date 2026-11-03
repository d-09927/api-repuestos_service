import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { PaginaResultado } from '../../../common/paginacion';
import { repoActual } from '../../../common/unidad-de-trabajo/transaccion-actual';
import { Venta } from '../../domain/entities/venta.entity';
import { EstadoVenta } from '../../domain/enums/estado-venta.enum';
import { FiltrosVenta, VentaRepositoryPort } from '../../domain/ports/venta.repository.port';
import { VentaOrmEntity } from '../entities/venta.orm-entity';

/** ADAPTADOR de salida: implementa VentaRepositoryPort con TypeORM + Postgres. */
@Injectable()
export class VentaTypeOrmRepository extends VentaRepositoryPort implements OnModuleInit {
  constructor(
    @InjectRepository(VentaOrmEntity)
    private readonly base: Repository<VentaOrmEntity>,
    private readonly dataSource: DataSource,
  ) {
    super();
  }

  /** La secuencia del número de venta no es una tabla: se crea aquí si no existe. */
  async onModuleInit(): Promise<void> {
    await this.dataSource.query('CREATE SEQUENCE IF NOT EXISTS ventas_consecutivo_seq');
  }

  async siguienteConsecutivo(): Promise<number> {
    const [fila] = await this.dataSource.query("SELECT nextval('ventas_consecutivo_seq') AS n");
    return Number(fila.n);
  }

  async guardar(venta: Venta): Promise<void> {
    await repoActual(this.base).save(this.aOrm(venta));
  }

  async buscarPorId(id: string): Promise<Venta | null> {
    const fila = await repoActual(this.base).findOne({ where: { id } });
    return fila ? this.aDominio(fila) : null;
  }

  async listar(f: FiltrosVenta): Promise<PaginaResultado<Venta>> {
    const qb = repoActual(this.base).createQueryBuilder('v');

    if (f.clienteId) qb.andWhere('v.clienteId = :clienteId', { clienteId: f.clienteId });
    if (f.desde) qb.andWhere('v.fecha >= :desde', { desde: f.desde });
    if (f.hasta) qb.andWhere('v.fecha <= :hasta', { hasta: f.hasta });

    qb.orderBy('v.fecha', 'DESC')
      .addOrderBy('v.numero', 'DESC')
      .skip((f.pagina - 1) * f.limite)
      .take(f.limite);

    const [filas, total] = await qb.getManyAndCount();
    return { items: filas.map((fila) => this.aDominio(fila)), total, pagina: f.pagina, limite: f.limite };
  }

  // --- traducción dominio <-> tabla ---

  private aOrm(v: Venta): VentaOrmEntity {
    return Object.assign(new VentaOrmEntity(), {
      id: v.id,
      numero: v.numero,
      clienteId: v.clienteId,
      bodega: v.bodega,
      observaciones: v.observaciones,
      total: v.total,
      estado: v.estado,
      referenciaPago: v.referenciaPago,
      pagadaEn: v.pagadaEn,
      fecha: v.fecha,
      creadoEn: v.creadoEn,
    });
  }

  private aDominio(f: VentaOrmEntity): Venta {
    return new Venta({
      id: f.id,
      numero: f.numero,
      clienteId: f.clienteId,
      bodega: f.bodega,
      observaciones: f.observaciones,
      total: f.total,
      estado: f.estado as EstadoVenta,
      referenciaPago: f.referenciaPago,
      pagadaEn: f.pagadaEn,
      fecha: f.fecha,
      creadoEn: f.creadoEn,
    });
  }
}
