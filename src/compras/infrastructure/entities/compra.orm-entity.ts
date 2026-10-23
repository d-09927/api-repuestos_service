import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryColumn, Relation } from 'typeorm';
import { numericTransformer } from '../../../common/numeric.transformer';
import { CompraDetalleOrmEntity } from '../../../compra-detalles/infrastructure/entities/compra-detalle.orm-entity';
import { ProveedorOrmEntity } from '../../../proveedores/infrastructure/entities/proveedor.orm-entity';

/** Tabla `compras`. Pertenece a un proveedor y tiene muchas líneas (compra_detalles). */
@Entity({ name: 'compras' })
export class CompraOrmEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ length: 20 })
  numero: string;

  @Index()
  @Column('uuid')
  proveedorId: string;

  @ManyToOne(() => ProveedorOrmEntity, (p) => p.compras, { nullable: false })
  @JoinColumn({ name: 'proveedorId' })
  proveedor: Relation<ProveedorOrmEntity>;

  @Column({ length: 50 })
  bodega: string;

  @Column({ type: 'varchar', length: 60, nullable: true })
  numeroFacturaProveedor: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  observaciones: string | null;

  @Column({ type: 'numeric', precision: 14, scale: 2, transformer: numericTransformer })
  total: number;

  @Index()
  @Column({ type: 'timestamptz' })
  fecha: Date;

  @Column({ type: 'timestamptz' })
  creadoEn: Date;

  @OneToMany(() => CompraDetalleOrmEntity, (h) => h.compra)
  detalles: Relation<CompraDetalleOrmEntity[]>;
}
