import { Column, Entity, Index, OneToMany, PrimaryColumn, Relation } from 'typeorm';
import { CompraOrmEntity } from '../../../compras/infrastructure/entities/compra.orm-entity';

@Entity({ name: 'proveedores' })
export class ProveedorOrmEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ length: 30 })
  nit: string;

  @Column({ length: 200 })
  nombre: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  contacto: string | null;

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

  @OneToMany(() => CompraOrmEntity, (h) => h.proveedor)
  compras: Relation<CompraOrmEntity[]>;
}
