import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'telegram_chats' })
export class TelegramChatOrmEntity {
  @PrimaryColumn({ length: 32 })
  chatId: string;

  @Column({ type: 'uuid', nullable: true })
  conversacionId: string | null;

  @Column({ length: 32 })
  usuarioId: string;

  @Column({ length: 200 })
  usuarioNombre: string;

  @Column({ type: 'timestamptz' })
  actualizadoEn: Date;
}
