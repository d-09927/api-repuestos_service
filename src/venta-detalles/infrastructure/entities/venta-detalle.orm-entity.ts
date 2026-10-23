import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn, Relation } from 'typeorm';
import { numericTransformer } from '../../../common/numeric.transformer';
import { RepuestoOrmEntity } from '../../../repuestos/infrastructure/entities/repuesto.orm-entity';
import { VentaOrmEntity } from '../../../ventas/infrastructure/entities/venta.orm-entity';

/** Tabla `venta_detalles`. Pertenece a una venta y a un repuesto (llaves foráneas). */
@Entity({ name: 'venta_detalles' })
export class VentaDetalleOrmEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Index()
  @Column('uuid')
  ventaId: string;

  @ManyToOne(() => VentaOrmEntity, (p) => p.detalles, { nullable: false })
  @JoinColumn({ name: 'ventaId' })
  venta: Relation<VentaOrmEntity>;

  @Column('uuid')
  repuestoId: string;

  @ManyToOne(() => RepuestoOrmEntity, (p) => p.lineasVenta, { nullable: false })
  @JoinColumn({ name: 'repuestoId' })
  repuesto: Relation<RepuestoOrmEntity>;

  @Column({ length: 50 })
  sku: string;

  @Column({ length: 200 })
  nombre: string;

  @Column('int')
  cantidad: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, transformer: numericTransformer })
  precioUnitario: number;

  @Column({ type: 'numeric', precision: 14, scale: 2, transformer: numericTransformer })
  subtotal: number;
}
