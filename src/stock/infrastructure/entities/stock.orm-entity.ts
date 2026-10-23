import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn, Relation } from 'typeorm';
import { RepuestoOrmEntity } from '../../../repuestos/infrastructure/entities/repuesto.orm-entity';

/** Tabla `stock`. Existencias de un repuesto en una bodega (llave foránea al repuesto). */
@Entity({ name: 'stock' })
@Index(['repuestoId', 'bodega'], { unique: true })
export class StockOrmEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column('uuid')
  repuestoId: string;

  @ManyToOne(() => RepuestoOrmEntity, (p) => p.stocks, { nullable: false })
  @JoinColumn({ name: 'repuestoId' })
  repuesto: Relation<RepuestoOrmEntity>;

  @Column({ length: 50 })
  bodega: string;

  @Column('int')
  cantidad: number;

  @Column('int')
  reservada: number;

  @Column('int')
  minimo: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  ubicacion: string | null;

  @Column({ type: 'timestamptz' })
  actualizadoEn: Date;
}
