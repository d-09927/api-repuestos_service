import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgenteModule } from '../agente/agente.module';
import { TelegramService } from './application/telegram.service';
import { TelegramChatRepositoryPort } from './domain/ports/telegram-chat.repository.port';
import { TelegramBotService } from './infrastructure/adapters/telegram-bot.service';
import { TelegramChatTypeOrmRepository } from './infrastructure/adapters/telegram-chat.typeorm.repository';
import { TelegramChatOrmEntity } from './infrastructure/entities/telegram-chat.orm-entity';

// Otra puerta de entrada al agente (como POST /api/agente/mensajes): usa AgenteService y su única tabla es telegram_chats.
@Module({
  imports: [AgenteModule, TypeOrmModule.forFeature([TelegramChatOrmEntity])],
  providers: [
    TelegramService,
    TelegramBotService,
    { provide: TelegramChatRepositoryPort, useClass: TelegramChatTypeOrmRepository },
  ],
})
export class TelegramModule {}
