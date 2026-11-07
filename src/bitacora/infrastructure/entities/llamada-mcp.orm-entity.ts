import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/** Tabla `mcp_bitacora`: una fila por llamada a una herramienta del MCP. */
@Entity({ name: 'mcp_bitacora' })
@Index(['creadoEn'])
@Index(['herramienta', 'creadoEn'])
export class LlamadaMcpOrmEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ length: 20 })
  llamante: string;

  @Column({ length: 100 })
  herramienta: string;

  @Column({ type: 'jsonb' })
  argumentos: Record<string, unknown>;

  @Column({ type: 'text', nullable: true })
  resultado: string | null;

  @Column('boolean')
  esError: boolean;

  @Column('int')
  duracionMs: number;

  @Column({ type: 'timestamptz' })
  creadoEn: Date;
}
