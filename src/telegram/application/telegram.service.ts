import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AgenteService } from '../../agente/application/agente.service';
import { TelegramChat } from '../domain/entities/telegram-chat.entity';
import { TelegramChatRepositoryPort } from '../domain/ports/telegram-chat.repository.port';
import { dividirMensaje } from './dividir-mensaje';

/** Mensajes por minuto que puede enviar cada usuario; evita que una persona sature el modelo. */
export const LIMITE_POR_MINUTO = 20;

export const MENSAJE_SIN_ACCESO = 'Este bot es de uso restringido. Su usuario no tiene acceso.';
export const MENSAJE_DEMASIADOS = 'Está enviando muchos mensajes. Espere un momento e intente de nuevo.';
export const MENSAJE_ERROR = 'Estoy teniendo problemas, intente en un momento.';
export const MENSAJE_AYUDA =
  'Escríbame lo que necesita, por ejemplo: "pastillas de freno para un Mazda 3 2018".\n\n' +
  'Puedo buscar repuestos, consultar precios y disponibilidad, y registrar su compra (siempre le pido confirmación antes).\n\n' +
  'Comandos:\n/nueva - empezar una conversación de cero\n/ayuda - ver este mensaje';
export const MENSAJE_BIENVENIDA = `¡Hola! Soy el asistente de repuestos.\n\n${MENSAJE_AYUDA}`;
export const MENSAJE_NUEVA = 'Listo, empezamos de cero. ¿Qué repuesto busca?';

/** Lo que el bot de Telegram le entrega al service: un mensaje de texto ya sin detalles de la librería. */
export interface MensajeEntrante {
  chatId: string;
  usuarioId: string;
  usuarioNombre: string;
  texto: string;
}

/**
 * Reglas del bot de Telegram: quién puede usarlo, comandos, límite por usuario, un mensaje a la vez por
 * chat y errores amables. No conoce la librería de Telegram: el adaptador (telegram-bot.service) la usa.
 */
@Injectable()
export class TelegramService {
  private readonly logger = new Logger('Telegram');
  private readonly permitidos: Set<string>;
  /** Cola por chat: si llegan tres mensajes seguidos se atienden en orden y no chocan en la conversación. */
  private readonly colas = new Map<string, Promise<unknown>>();
  /** Instantes de los mensajes del último minuto, por usuario. */
  private readonly recientes = new Map<string, number[]>();

  constructor(
    private readonly agente: AgenteService,
    private readonly chats: TelegramChatRepositoryPort,
    config: ConfigService,
  ) {
    this.permitidos = new Set(
      config
        .get<string>('TELEGRAM_USUARIOS_PERMITIDOS', '')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean),
    );
  }

  /** Devuelve los mensajes que hay que enviar al chat, ya partidos para que quepan en Telegram. */
  async responder(mensaje: MensajeEntrante): Promise<string[]> {
    // Con la lista vacía el bot queda cerrado: puede registrar ventas, así que nadie entra por omisión.
    if (!this.permitidos.has(mensaje.usuarioId)) {
      this.logger.warn(`Acceso denegado al usuario ${mensaje.usuarioId} (${mensaje.usuarioNombre})`);
      return [MENSAJE_SIN_ACCESO];
    }

    const comando = comandoDe(mensaje.texto);
    if (comando) return this.comando(comando, mensaje);

    if (this.excedeLimite(mensaje.usuarioId)) return [MENSAJE_DEMASIADOS];

    try {
      return await this.enCola(mensaje.chatId, () => this.conversar(mensaje));
    } catch (error) {
      this.logger.error(`Falló la respuesta al chat ${mensaje.chatId}: ${error instanceof Error ? error.message : error}`);
      return [MENSAJE_ERROR];
    }
  }

  private async comando(comando: string, mensaje: MensajeEntrante): Promise<string[]> {
    switch (comando) {
      case '/start':
        return [MENSAJE_BIENVENIDA];
      case '/nueva':
        await this.guardarChat(mensaje, null);
        return [MENSAJE_NUEVA];
      default:
        return [MENSAJE_AYUDA];
    }
  }

  private async conversar(mensaje: MensajeEntrante): Promise<string[]> {
    const chat = await this.chats.buscar(mensaje.chatId);
    const r = await this.agente.responder(mensaje.texto, chat?.conversacionId ?? undefined);
    await this.guardarChat(mensaje, r.conversacionId);
    return dividirMensaje(r.respuesta);
  }

  private guardarChat(mensaje: MensajeEntrante, conversacionId: string | null): Promise<void> {
    return this.chats.guardar(
      new TelegramChat({
        chatId: mensaje.chatId,
        conversacionId,
        usuarioId: mensaje.usuarioId,
        usuarioNombre: mensaje.usuarioNombre,
        actualizadoEn: new Date(),
      }),
    );
  }

  private excedeLimite(usuarioId: string): boolean {
    const ahora = Date.now();
    const vigentes = (this.recientes.get(usuarioId) ?? []).filter((t) => ahora - t < 60_000);
    if (vigentes.length >= LIMITE_POR_MINUTO) {
      this.recientes.set(usuarioId, vigentes);
      return true;
    }
    vigentes.push(ahora);
    this.recientes.set(usuarioId, vigentes);
    return false;
  }

  private enCola<T>(chatId: string, tarea: () => Promise<T>): Promise<T> {
    const previa = this.colas.get(chatId) ?? Promise.resolve();
    const actual = previa.then(tarea);
    // La cola sigue aunque una tarea falle; y se limpia cuando no queda nadie esperando.
    const marca = actual.then(
      () => undefined,
      () => undefined,
    );
    this.colas.set(chatId, marca);
    void marca.then(() => {
      if (this.colas.get(chatId) === marca) this.colas.delete(chatId);
    });
    return actual;
  }
}

/** "/nueva@MiBot algo" → "/nueva". Null si el texto no es un comando. */
function comandoDe(texto: string): string | null {
  const t = texto.trim();
  if (!t.startsWith('/')) return null;
  return t.split(/\s+/)[0].split('@')[0].toLowerCase();
}
