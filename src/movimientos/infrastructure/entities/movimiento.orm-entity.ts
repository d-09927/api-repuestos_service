import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn, Relation } from 'typeorm';
import { RepuestoOrmEntity } from '../../../repuestos/infrastructure/entities/repuesto.orm-entity';

/** Tabla `movimientos`. Pertenece a un repuesto (llave foránea). */
@Entity({ name: 'movimientos' })
@Index(['repuestoId', 'creadoEn'])
export class MovimientoOrmEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column('uuid')
  repuestoId: string;

  @ManyToOne(() => RepuestoOrmEntity, (p) => p.movimientos, { nullable: false })
  @JoinColumn({ name: 'repuestoId' })
  repuesto: Relation<RepuestoOrmEntity>;

  @Column({ length: 50 })
  bodega: string;

  @Column({ length: 20 })
  tipo: string;

  @Column('int')
  cantidad: number;

  @Column('int')
  cantidadResultante: number;

  @Column({ type: 'varchar', length: 200, nullable: true })
  motivo: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  referencia: string | null;

  @Column({ type: 'timestamptz' })
  creadoEn: Date;
}
