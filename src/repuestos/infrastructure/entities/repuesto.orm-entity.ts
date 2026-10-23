import { Column, Entity, Index, OneToMany, PrimaryColumn, Relation } from 'typeorm';
import { numericTransformer } from '../../../common/numeric.transformer';
import { CompatibilidadOrmEntity } from '../../../compatibilidades/infrastructure/entities/compatibilidad.orm-entity';
import { CompraDetalleOrmEntity } from '../../../compra-detalles/infrastructure/entities/compra-detalle.orm-entity';
import { MovimientoOrmEntity } from '../../../movimientos/infrastructure/entities/movimiento.orm-entity';
import { StockOrmEntity } from '../../../stock/infrastructure/entities/stock.orm-entity';
import { VentaDetalleOrmEntity } from '../../../venta-detalles/infrastructure/entities/venta-detalle.orm-entity';

/**
 * Entidad de TypeORM: es el "modelo de la tabla", distinto de la entidad de dominio
 * (domain/entities/repuesto.entity.ts). El adaptador traduce entre ambas.
 */
@Entity({ name: 'repuestos' })
export class RepuestoOrmEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ length: 50 })
  sku: string;

  @Column({ length: 200 })
  nombre: string;

  @Column({ type: 'text', nullable: true })
  descripcion: string | null;

  @Index()
  @Column({ length: 100 })
  marca: string;

  @Index()
  @Column({ length: 100 })
  categoria: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, transformer: numericTransformer })
  precio: number;

  @Column({ default: true })
  activo: boolean;

  @Column({ type: 'timestamptz' })
  creadoEn: Date;

  @Column({ type: 'timestamptz' })
  actualizadoEn: Date;

  @OneToMany(() => CompatibilidadOrmEntity, (h) => h.repuesto)
  compatibilidades: Relation<CompatibilidadOrmEntity[]>;

  @OneToMany(() => StockOrmEntity, (h) => h.repuesto)
  stocks: Relation<StockOrmEntity[]>;

  @OneToMany(() => MovimientoOrmEntity, (h) => h.repuesto)
  movimientos: Relation<MovimientoOrmEntity[]>;

  @OneToMany(() => CompraDetalleOrmEntity, (h) => h.repuesto)
  lineasCompra: Relation<CompraDetalleOrmEntity[]>;

  @OneToMany(() => VentaDetalleOrmEntity, (h) => h.repuesto)
  lineasVenta: Relation<VentaDetalleOrmEntity[]>;
}
