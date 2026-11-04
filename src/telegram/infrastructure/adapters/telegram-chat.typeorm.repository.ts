import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TelegramChat } from '../../domain/entities/telegram-chat.entity';
import { TelegramChatRepositoryPort } from '../../domain/ports/telegram-chat.repository.port';
import { TelegramChatOrmEntity } from '../entities/telegram-chat.orm-entity';

/** ADAPTADOR de salida: implementa TelegramChatRepositoryPort con TypeORM + Postgres. */
@Injectable()
export class TelegramChatTypeOrmRepository extends TelegramChatRepositoryPort {
  constructor(
    @InjectRepository(TelegramChatOrmEntity)
    private readonly orm: Repository<TelegramChatOrmEntity>,
  ) {
    super();
  }

  async buscar(chatId: string): Promise<TelegramChat | null> {
    const fila = await this.orm.findOne({ where: { chatId } });
    return fila ? new TelegramChat({ ...fila }) : null;
  }

  async guardar(chat: TelegramChat): Promise<void> {
    await this.orm.save(Object.assign(new TelegramChatOrmEntity(), { ...chat }));
  }
}
