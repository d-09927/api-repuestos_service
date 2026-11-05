import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryColumn, Relation } from 'typeorm';
import { numericTransformer } from '../../../common/numeric.transformer';
import { ClienteOrmEntity } from '../../../clientes/infrastructure/entities/cliente.orm-entity';
import { VentaDetalleOrmEntity } from '../../../venta-detalles/infrastructure/entities/venta-detalle.orm-entity';

/** Tabla `ventas`. Puede tener un cliente (opcional) y tiene muchas líneas (venta_detalles). */
@Entity({ name: 'ventas' })
export class VentaOrmEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ length: 20 })
  numero: string;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  clienteId: string | null;

  @ManyToOne(() => ClienteOrmEntity, (p) => p.ventas, { nullable: true })
  @JoinColumn({ name: 'clienteId' })
  cliente: Relation<ClienteOrmEntity | null>;

  @Index()
  @Column({ type: 'varchar', length: 17, nullable: true })
  vin: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  codigoOrden: string | null;

  @Column({ length: 50 })
  bodega: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  observaciones: string | null;

  @Column({ type: 'numeric', precision: 14, scale: 2, transformer: numericTransformer })
  total: number;

  /** Las ventas anteriores a este campo eran todas de mostrador: quedan PAGADA. */
  @Index()
  @Column({ length: 20, default: 'PAGADA' })
  estado: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  referenciaPago: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  pagadaEn: Date | null;

  @Index()
  @Column({ type: 'timestamptz' })
  fecha: Date;

  @Column({ type: 'timestamptz' })
  creadoEn: Date;

  @OneToMany(() => VentaDetalleOrmEntity, (h) => h.venta)
  detalles: Relation<VentaDetalleOrmEntity[]>;
}
