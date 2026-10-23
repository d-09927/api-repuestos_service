import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn, Relation } from 'typeorm';
import { RepuestoOrmEntity } from '../../../repuestos/infrastructure/entities/repuesto.orm-entity';

/** Tabla `compatibilidades`. Pertenece a un repuesto (llave foránea). */
@Entity({ name: 'compatibilidades' })
export class CompatibilidadOrmEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Index()
  @Column('uuid')
  repuestoId: string;

  @ManyToOne(() => RepuestoOrmEntity, (p) => p.compatibilidades, { nullable: false })
  @JoinColumn({ name: 'repuestoId' })
  repuesto: Relation<RepuestoOrmEntity>;

  @Column({ length: 100 })
  marca: string;

  @Column({ length: 100 })
  modelo: string;

  @Column('int')
  anioDesde: number;

  @Column('int')
  anioHasta: number;
}
