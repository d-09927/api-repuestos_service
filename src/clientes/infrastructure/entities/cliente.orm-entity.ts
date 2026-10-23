import { Column, Entity, Index, OneToMany, PrimaryColumn, Relation } from 'typeorm';
import { VentaOrmEntity } from '../../../ventas/infrastructure/entities/venta.orm-entity';

@Entity({ name: 'clientes' })
@Index(['tipoDocumento', 'documento'], { unique: true })
export class ClienteOrmEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ length: 20 })
  tipoDocumento: string;

  @Column({ length: 30 })
  documento: string;

  @Column({ length: 200 })
  nombre: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  telefono: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 250, nullable: true })
  direccion: string | null;

  @Column({ default: true })
  activo: boolean;

  @Column({ type: 'timestamptz' })
  creadoEn: Date;

  @Column({ type: 'timestamptz' })
  actualizadoEn: Date;

  @OneToMany(() => VentaOrmEntity, (h) => h.cliente)
  ventas: Relation<VentaOrmEntity[]>;
}
