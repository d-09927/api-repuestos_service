import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { PaginaResultado } from '../../../common/paginacion';
import { repoActual } from '../../../common/unidad-de-trabajo/transaccion-actual';
import { Compra } from '../../domain/entities/compra.entity';
import { CompraRepositoryPort, FiltrosCompra } from '../../domain/ports/compra.repository.port';
import { CompraOrmEntity } from '../entities/compra.orm-entity';

/** ADAPTADOR de salida: implementa CompraRepositoryPort con TypeORM + Postgres. */
@Injectable()
export class CompraTypeOrmRepository extends CompraRepositoryPort implements OnModuleInit {
  constructor(
    @InjectRepository(CompraOrmEntity)
    private readonly base: Repository<CompraOrmEntity>,
    private readonly dataSource: DataSource,
  ) {
    super();
  }

  /** La secuencia del número de compra no es una tabla: se crea aquí si no existe. */
  async onModuleInit(): Promise<void> {
    await this.dataSource.query('CREATE SEQUENCE IF NOT EXISTS compras_consecutivo_seq');
  }

  async siguienteConsecutivo(): Promise<number> {
    const [fila] = await this.dataSource.query("SELECT nextval('compras_consecutivo_seq') AS n");
    return Number(fila.n);
  }

  async guardar(compra: Compra): Promise<void> {
    await repoActual(this.base).save(this.aOrm(compra));
  }

  async buscarPorId(id: string): Promise<Compra | null> {
    const fila = await repoActual(this.base).findOne({ where: { id } });
    return fila ? this.aDominio(fila) : null;
  }

  async listar(f: FiltrosCompra): Promise<PaginaResultado<Compra>> {
    const qb = repoActual(this.base).createQueryBuilder('c');

    if (f.proveedorId) qb.andWhere('c.proveedorId = :proveedorId', { proveedorId: f.proveedorId });
    if (f.desde) qb.andWhere('c.fecha >= :desde', { desde: f.desde });
    if (f.hasta) qb.andWhere('c.fecha <= :hasta', { hasta: f.hasta });

    qb.orderBy('c.fecha', 'DESC')
      .addOrderBy('c.numero', 'DESC')
      .skip((f.pagina - 1) * f.limite)
      .take(f.limite);

    const [filas, total] = await qb.getManyAndCount();
    return { items: filas.map((fila) => this.aDominio(fila)), total, pagina: f.pagina, limite: f.limite };
  }

  // --- traducción dominio <-> tabla ---

  private aOrm(c: Compra): CompraOrmEntity {
    return Object.assign(new CompraOrmEntity(), {
      id: c.id,
      numero: c.numero,
      proveedorId: c.proveedorId,
      bodega: c.bodega,
      numeroFacturaProveedor: c.numeroFacturaProveedor,
      observaciones: c.observaciones,
      total: c.total,
      fecha: c.fecha,
      creadoEn: c.creadoEn,
    });
  }

  private aDominio(f: CompraOrmEntity): Compra {
    return new Compra({
      id: f.id,
      numero: f.numero,
      proveedorId: f.proveedorId,
      bodega: f.bodega,
      numeroFacturaProveedor: f.numeroFacturaProveedor,
      observaciones: f.observaciones,
      total: f.total,
      fecha: f.fecha,
      creadoEn: f.creadoEn,
    });
  }
}
