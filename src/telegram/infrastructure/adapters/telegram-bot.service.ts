import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot, Context } from 'grammy';
import { TelegramService } from '../../application/telegram.service';

/** Cada cuántos ms se renueva "escribiendo…" (Telegram lo apaga a los ~5 segundos). */
const REPETIR_ESCRIBIENDO_MS = 4000;

/**
 * ADAPTADOR de entrada: conecta el bot de Telegram (polling) con TelegramService. Sin TELEGRAM_BOT_TOKEN
 * no arranca y la API sigue normal. Si el token es inválido lo registra y tampoco tumba la API.
 */
@Injectable()
export class TelegramBotService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger('TelegramBot');
  private bot?: Bot;

  constructor(
    private readonly telegram: TelegramService,
    private readonly config: ConfigService,
  ) {}

  onApplicationBootstrap() {
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token) {
      this.logger.log('TELEGRAM_BOT_TOKEN no está definido: el bot de Telegram queda desactivado');
      return;
    }

    const bot = new Bot(token);
    // No se espera a que termine: grammY atiende los mensajes de uno en uno y, con el modelo tardando
    // minutos, un chat lento dejaría sin respuesta a todos los demás. El orden dentro de cada chat
    // lo garantiza TelegramService.
    bot.on('message:text', (ctx) => {
      void this.atender(ctx);
    });
    bot.catch((error) => this.logger.error(`Error en el bot: ${error.message}`));

    this.bot = bot;
    // start() corre mientras el bot viva: no se espera para no bloquear el arranque de la API.
    bot
      .start({ onStart: (yo) => this.logger.log(`Bot de Telegram activo como @${yo.username} (polling)`) })
      .catch((error: Error) => this.logger.error(`No se pudo iniciar el bot de Telegram: ${error.message}`));
  }

  async onApplicationShutdown() {
    await this.bot?.stop();
  }

  private async atender(ctx: Context) {
    const texto = ctx.message?.text;
    if (!ctx.chat || !ctx.from || !texto) return;

    const escribiendo = () => ctx.replyWithChatAction('typing').catch(() => undefined);
    void escribiendo();
    const temporizador = setInterval(escribiendo, REPETIR_ESCRIBIENDO_MS);
    try {
      const partes = await this.telegram.responder({
        chatId: String(ctx.chat.id),
        usuarioId: String(ctx.from.id),
        usuarioNombre: [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(' ') || ctx.from.username || 'sin nombre',
        texto,
      });
      for (const parte of partes) await ctx.reply(parte);
    } catch (error) {
      this.logger.error(`No se pudo responder al chat ${ctx.chat.id}: ${error instanceof Error ? error.message : error}`);
    } finally {
      clearInterval(temporizador);
    }
  }
}
