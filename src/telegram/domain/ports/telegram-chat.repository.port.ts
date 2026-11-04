import { TelegramChat } from '../entities/telegram-chat.entity';

/** PUERTO de salida: guardar y leer los chats de Telegram. La implementación vive en infrastructure/adapters. */
export abstract class TelegramChatRepositoryPort {
  abstract buscar(chatId: string): Promise<TelegramChat | null>;
  /** Crea el chat o actualiza el existente. */
  abstract guardar(chat: TelegramChat): Promise<void>;
}
