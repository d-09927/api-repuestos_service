import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import type { LlamadaGuardada } from '../../domain/entities/mensaje-conversacion.entity';

@Entity({ name: 'agente_mensajes' })
// Único: si llegan dos mensajes a la vez en la misma conversación, el segundo falla en lugar de mezclarse.
@Index(['conversacionId', 'orden'], { unique: true })
export class MensajeConversacionOrmEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column('uuid')
  conversacionId: string;

  @Column('int')
  orden: number;

  @Column({ length: 20 })
  rol: string;

  @Column({ type: 'text', nullable: true })
  contenido: string | null;

  @Column({ type: 'jsonb', nullable: true })
  llamadas: LlamadaGuardada[] | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  llamadaId: string | null;

  @Column({ type: 'timestamptz' })
  creadoEn: Date;
}
