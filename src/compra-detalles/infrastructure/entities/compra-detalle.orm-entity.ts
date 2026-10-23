import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn, Relation } from 'typeorm';
import { numericTransformer } from '../../../common/numeric.transformer';
import { CompraOrmEntity } from '../../../compras/infrastructure/entities/compra.orm-entity';
import { RepuestoOrmEntity } from '../../../repuestos/infrastructure/entities/repuesto.orm-entity';

/** Tabla `compra_detalles`. Pertenece a una compra y a un repuesto (llaves foráneas). */
@Entity({ name: 'compra_detalles' })
export class CompraDetalleOrmEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Index()
  @Column('uuid')
  compraId: string;

  @ManyToOne(() => CompraOrmEntity, (p) => p.detalles, { nullable: false })
  @JoinColumn({ name: 'compraId' })
  compra: Relation<CompraOrmEntity>;

  @Column('uuid')
  repuestoId: string;

  @ManyToOne(() => RepuestoOrmEntity, (p) => p.lineasCompra, { nullable: false })
  @JoinColumn({ name: 'repuestoId' })
  repuesto: Relation<RepuestoOrmEntity>;

  @Column({ length: 50 })
  sku: string;

  @Column({ length: 200 })
  nombre: string;

  @Column('int')
  cantidad: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, transformer: numericTransformer })
  costoUnitario: number;

  @Column({ type: 'numeric', precision: 14, scale: 2, transformer: numericTransformer })
  subtotal: number;
}
