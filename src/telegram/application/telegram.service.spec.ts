import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AgenteService, RespuestaAgente } from '../../agente/application/agente.service';
import { TelegramChat } from '../domain/entities/telegram-chat.entity';
import { TelegramChatRepositoryPort } from '../domain/ports/telegram-chat.repository.port';
import { dividirMensaje } from './dividir-mensaje';
import {
  LIMITE_POR_MINUTO,
  MENSAJE_AYUDA,
  MENSAJE_BIENVENIDA,
  MENSAJE_DEMASIADOS,
  MENSAJE_ERROR,
  MENSAJE_NUEVA,
  MENSAJE_SIN_ACCESO,
  MensajeEntrante,
  TelegramService,
} from './telegram.service';

/** Repositorio en memoria: permite probar el bot sin base de datos. */
class ChatsEnMemoria extends TelegramChatRepositoryPort {
  filas = new Map<string, TelegramChat>();
  async buscar(chatId: string) {
    return this.filas.get(chatId) ?? null;
  }
  async guardar(chat: TelegramChat) {
    this.filas.set(chat.chatId, chat);
  }
}

const mensaje = (texto: string, extra: Partial<MensajeEntrante> = {}): MensajeEntrante => ({
  chatId: '100',
  usuarioId: '7',
  usuarioNombre: 'Ana Pérez',
  texto,
  ...extra,
});

describe('TelegramService', () => {
  let responderAgente: jest.Mock<Promise<RespuestaAgente>, [string, string | undefined]>;
  let chats: ChatsEnMemoria;
  let telegram: TelegramService;

  const crear = (permitidos = '7, 8') => {
    telegram = new TelegramService(
      { responder: responderAgente } as unknown as AgenteService,
      chats,
      new ConfigService({ TELEGRAM_USUARIOS_PERMITIDOS: permitidos }),
    );
  };

  beforeAll(() => Logger.overrideLogger(false));

  beforeEach(() => {
    responderAgente = jest.fn().mockResolvedValue({ conversacionId: 'conv-1', respuesta: 'Hola, ¿qué busca?', herramientas: [] });
    chats = new ChatsEnMemoria();
    crear();
  });

  describe('acceso', () => {
    it('rechaza a un usuario que no está en la lista y no llama al agente', async () => {
      expect(await telegram.responder(mensaje('hola', { usuarioId: '999' }))).toEqual([MENSAJE_SIN_ACCESO]);
      expect(responderAgente).not.toHaveBeenCalled();
    });

    it('con la lista vacía el bot queda cerrado para todos', async () => {
      crear('');
      expect(await telegram.responder(mensaje('hola'))).toEqual([MENSAJE_SIN_ACCESO]);
    });

    it('también rechaza los comandos de quien no tiene acceso', async () => {
      expect(await telegram.responder(mensaje('/nueva', { usuarioId: '999' }))).toEqual([MENSAJE_SIN_ACCESO]);
      expect(chats.filas.size).toBe(0);
    });
  });

  describe('conversación', () => {
    it('el primer mensaje empieza una conversación y guarda quién escribió', async () => {
      expect(await telegram.responder(mensaje('hola'))).toEqual(['Hola, ¿qué busca?']);

      expect(responderAgente).toHaveBeenCalledWith('hola', undefined);
      expect(chats.filas.get('100')).toMatchObject({ conversacionId: 'conv-1', usuarioId: '7', usuarioNombre: 'Ana Pérez' });
    });

    it('los mensajes siguientes continúan la misma conversación', async () => {
      await telegram.responder(mensaje('hola'));
      await telegram.responder(mensaje('pastillas de freno'));

      expect(responderAgente).toHaveBeenLastCalledWith('pastillas de freno', 'conv-1');
    });

    it('cada chat tiene su propia conversación', async () => {
      responderAgente
        .mockResolvedValueOnce({ conversacionId: 'conv-a', respuesta: 'a', herramientas: [] })
        .mockResolvedValueOnce({ conversacionId: 'conv-b', respuesta: 'b', herramientas: [] });

      await telegram.responder(mensaje('hola', { chatId: '1', usuarioId: '7' }));
      await telegram.responder(mensaje('hola', { chatId: '2', usuarioId: '8' }));

      expect(chats.filas.get('1')?.conversacionId).toBe('conv-a');
      expect(chats.filas.get('2')?.conversacionId).toBe('conv-b');
    });

    it('parte la respuesta si pasa de 4096 caracteres', async () => {
      responderAgente.mockResolvedValue({ conversacionId: 'conv-1', respuesta: 'palabra '.repeat(1000), herramientas: [] });

      const partes = await telegram.responder(mensaje('lista completa'));

      expect(partes.length).toBeGreaterThan(1);
      expect(partes.every((p) => p.length <= 4096)).toBe(true);
    });
  });

  describe('comandos', () => {
    it('/start saluda y /ayuda explica, sin llamar al agente', async () => {
      expect(await telegram.responder(mensaje('/start'))).toEqual([MENSAJE_BIENVENIDA]);
      expect(await telegram.responder(mensaje('/ayuda'))).toEqual([MENSAJE_AYUDA]);
      expect(responderAgente).not.toHaveBeenCalled();
    });

    it('reconoce el comando con el nombre del bot (/nueva@MiBot)', async () => {
      expect(await telegram.responder(mensaje('/nueva@MiBot'))).toEqual([MENSAJE_NUEVA]);
    });

    it('/nueva olvida la conversación: el siguiente mensaje empieza de cero', async () => {
      await telegram.responder(mensaje('hola'));
      expect(await telegram.responder(mensaje('/nueva'))).toEqual([MENSAJE_NUEVA]);
      expect(chats.filas.get('100')?.conversacionId).toBeNull();

      await telegram.responder(mensaje('otra cosa'));

      expect(responderAgente).toHaveBeenLastCalledWith('otra cosa', undefined);
    });

    it('un comando desconocido responde con la ayuda', async () => {
      expect(await telegram.responder(mensaje('/xyz'))).toEqual([MENSAJE_AYUDA]);
    });
  });

  describe('control de mensajes', () => {
    it('atiende en orden los mensajes seguidos del mismo chat, sin que choquen', async () => {
      const orden: string[] = [];
      let liberar: () => void = () => undefined;
      responderAgente.mockImplementation(async (texto) => {
        orden.push(`inicio ${texto}`);
        if (texto === 'uno') await new Promise<void>((r) => (liberar = r));
        orden.push(`fin ${texto}`);
        return { conversacionId: 'conv-1', respuesta: texto, herramientas: [] };
      });

      const uno = telegram.responder(mensaje('uno'));
      const dos = telegram.responder(mensaje('dos'));
      await new Promise((r) => setImmediate(r));
      expect(orden).toEqual(['inicio uno']);

      liberar();
      await Promise.all([uno, dos]);

      expect(orden).toEqual(['inicio uno', 'fin uno', 'inicio dos', 'fin dos']);
    });

    it('si un mensaje falla, el siguiente del mismo chat se atiende igual', async () => {
      responderAgente.mockRejectedValueOnce(new Error('el modelo no responde'));

      expect(await telegram.responder(mensaje('uno'))).toEqual([MENSAJE_ERROR]);
      expect(await telegram.responder(mensaje('dos'))).toEqual(['Hola, ¿qué busca?']);
    });

    it('limita los mensajes por minuto de cada usuario', async () => {
      for (let i = 0; i < LIMITE_POR_MINUTO; i++) await telegram.responder(mensaje(`m${i}`));

      expect(await telegram.responder(mensaje('uno de más'))).toEqual([MENSAJE_DEMASIADOS]);
      expect(responderAgente).toHaveBeenCalledTimes(LIMITE_POR_MINUTO);
      // Otro usuario no se ve afectado.
      expect(await telegram.responder(mensaje('hola', { usuarioId: '8', chatId: '200' }))).toEqual(['Hola, ¿qué busca?']);
    });

    it('pasado el minuto el usuario vuelve a poder escribir', async () => {
      const ahora = jest.spyOn(Date, 'now');
      ahora.mockReturnValue(1_000_000);
      for (let i = 0; i < LIMITE_POR_MINUTO; i++) await telegram.responder(mensaje(`m${i}`));

      ahora.mockReturnValue(1_000_000 + 61_000);
      expect(await telegram.responder(mensaje('de nuevo'))).toEqual(['Hola, ¿qué busca?']);
      ahora.mockRestore();
    });

    it('si el agente falla, el cliente ve un mensaje amable y no el error técnico', async () => {
      responderAgente.mockRejectedValue(new Error('No hay conexion con el modelo en http://localhost:11434/v1'));

      const partes = await telegram.responder(mensaje('hola'));

      expect(partes).toEqual([MENSAJE_ERROR]);
      expect(partes[0]).not.toMatch(/localhost|modelo/);
    });
  });
});

describe('dividirMensaje', () => {
  it('un texto corto queda en un solo mensaje', () => {
    expect(dividirMensaje('hola')).toEqual(['hola']);
  });

  it('corta en un espacio o salto de línea sin partir palabras', () => {
    const partes = dividirMensaje('uno dos tres cuatro', 10);

    expect(partes).toEqual(['uno dos', 'tres', 'cuatro']);
  });

  it('un texto sin espacios se corta en el límite', () => {
    expect(dividirMensaje('a'.repeat(25), 10).map((p) => p.length)).toEqual([10, 10, 5]);
  });
});
