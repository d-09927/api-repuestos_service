import { Logger } from '@nestjs/common';
import { NotFoundError } from '../../common/domain-error';
import type { IaService, LlamadaHerramienta, Mensaje, RespuestaModelo } from '../../ia/ia.service';
import { MensajeConversacion } from '../domain/entities/mensaje-conversacion.entity';
import { ConversacionRepositoryPort } from '../domain/ports/conversacion.repository.port';
import { AgenteService, LIMITE_HISTORIAL, MAX_VUELTAS } from './agente.service';
import type { McpClienteService, SesionMcp } from './mcp-cliente.service';

/** Repositorio en memoria: permite probar la memoria del agente sin base de datos. */
class ConversacionesEnMemoria extends ConversacionRepositoryPort {
  filas: MensajeConversacion[] = [];
  async existe(conversacionId: string) {
    return this.filas.some((m) => m.conversacionId === conversacionId);
  }
  async ultimos(conversacionId: string, limite: number) {
    return this.filas
      .filter((m) => m.conversacionId === conversacionId)
      .sort((a, b) => a.orden - b.orden)
      .slice(-limite);
  }
  async guardar(mensajes: MensajeConversacion[]) {
    this.filas.push(...mensajes);
  }
}

// Modelo y MCP falsos: el spec prueba el bucle y la memoria.
const pide = (id: string, name: string, args: object): LlamadaHerramienta => ({
  id,
  type: 'function',
  function: { name, arguments: JSON.stringify(args) },
});
const textoFinal = (texto: string): RespuestaModelo => ({ texto, llamadas: [] });
const pideHerramientas = (...llamadas: LlamadaHerramienta[]): RespuestaModelo => ({ texto: '', llamadas });

describe('AgenteService', () => {
  let completar: jest.Mock<Promise<RespuestaModelo>, [Mensaje[], unknown]>;
  let sesion: jest.Mocked<SesionMcp>;
  let conversaciones: ConversacionesEnMemoria;
  let agente: AgenteService;

  /** Los mensajes que recibió el modelo en la llamada n (empieza en 0). */
  const vistoEn = (n: number) => completar.mock.calls[n][0];

  beforeAll(() => Logger.overrideLogger(false));

  beforeEach(() => {
    completar = jest.fn();
    sesion = {
      herramientas: [{ type: 'function', function: { name: 'buscar_repuestos', parameters: { type: 'object' } } }],
      ejecutar: jest.fn().mockResolvedValue('{"items":[{"sku":"BOS-FA-110","precio":25000}]}'),
      cerrar: jest.fn().mockResolvedValue(undefined),
    };
    conversaciones = new ConversacionesEnMemoria();
    agente = new AgenteService(
      // Se pasa una copia: el bucle sigue agregando al mismo arreglo después de cada llamada.
      { completar: (m: Mensaje[], h: unknown) => completar([...m], h) } as unknown as IaService,
      { abrir: async () => sesion } as unknown as McpClienteService,
      conversaciones,
    );
  });

  describe('bucle', () => {
    it('si el modelo responde con texto, lo devuelve sin usar herramientas', async () => {
      completar.mockResolvedValueOnce(textoFinal('¡Hola! ¿Qué repuesto busca?'));

      const r = await agente.responder('hola');

      expect(r.respuesta).toBe('¡Hola! ¿Qué repuesto busca?');
      expect(r.herramientas).toEqual([]);
      expect(sesion.ejecutar).not.toHaveBeenCalled();
      expect(vistoEn(0)[0].role).toBe('system');
      expect(vistoEn(0)[1]).toEqual({ role: 'user', content: 'hola' });
      expect(completar.mock.calls[0][1]).toBe(sesion.herramientas);
    });

    it('ejecuta la herramienta pedida y le devuelve el resultado al modelo', async () => {
      const llamada = pide('c1', 'buscar_repuestos', { texto: 'filtro' });
      completar
        .mockResolvedValueOnce(pideHerramientas(llamada))
        .mockResolvedValueOnce(textoFinal('Sí, el filtro BOS-FA-110 cuesta $25.000.'));

      const r = await agente.responder('¿tienen filtro?');

      expect(sesion.ejecutar).toHaveBeenCalledWith(llamada);
      expect(r.respuesta).toBe('Sí, el filtro BOS-FA-110 cuesta $25.000.');
      expect(r.herramientas).toEqual(['buscar_repuestos']);
      // En la segunda vuelta el modelo ve su pedido y el resultado, enlazados por el id.
      expect(vistoEn(1).slice(2)).toEqual([
        { role: 'assistant', content: null, tool_calls: [llamada] },
        { role: 'tool', tool_call_id: 'c1', content: '{"items":[{"sku":"BOS-FA-110","precio":25000}]}' },
      ]);
    });

    it('ejecuta varias herramientas pedidas en la misma vuelta', async () => {
      completar
        .mockResolvedValueOnce(pideHerramientas(pide('a', 'consultar_stock', {}), pide('b', 'buscar_clientes', {})))
        .mockResolvedValueOnce(textoFinal('Listo'));

      const r = await agente.responder('...');

      expect(r.herramientas).toEqual(['consultar_stock', 'buscar_clientes']);
      expect(vistoEn(1).filter((m) => m.role === 'tool')).toHaveLength(2);
    });

    it('se detiene después del máximo de vueltas si el modelo nunca responde con texto', async () => {
      completar.mockResolvedValue(pideHerramientas(pide('x', 'buscar_repuestos', {})));

      const r = await agente.responder('...');

      expect(completar).toHaveBeenCalledTimes(MAX_VUELTAS);
      expect(r.respuesta).toMatch(/No pude completar/);
    });

    it('cierra la sesión del MCP aunque el modelo falle', async () => {
      completar.mockRejectedValue(new Error('modelo caído'));

      await expect(agente.responder('hola')).rejects.toThrow('modelo caído');
      expect(sesion.cerrar).toHaveBeenCalled();
    });
  });

  describe('memoria', () => {
    it('sin conversacionId crea una conversación nueva y guarda la pregunta y la respuesta', async () => {
      completar.mockResolvedValueOnce(textoFinal('¡Hola!'));

      const r = await agente.responder('hola');

      expect(r.conversacionId).toMatch(/^[0-9a-f-]{36}$/);
      expect(conversaciones.filas.map((m) => [m.orden, m.rol, m.contenido])).toEqual([
        [1, 'user', 'hola'],
        [2, 'assistant', '¡Hola!'],
      ]);
      expect(conversaciones.filas.every((m) => m.conversacionId === r.conversacionId)).toBe(true);
    });

    it('guarda los pedidos de herramientas y sus resultados, en orden', async () => {
      completar
        .mockResolvedValueOnce(pideHerramientas(pide('c1', 'buscar_repuestos', { texto: 'filtro' })))
        .mockResolvedValueOnce(textoFinal('Hay uno a $25.000'));

      await agente.responder('¿tienen filtro?');

      const [, pedido, resultado, final] = conversaciones.filas;
      expect(pedido).toMatchObject({
        orden: 2,
        rol: 'assistant',
        contenido: null,
        llamadas: [{ id: 'c1', nombre: 'buscar_repuestos', argumentos: '{"texto":"filtro"}' }],
      });
      expect(resultado).toMatchObject({ orden: 3, rol: 'tool', llamadaId: 'c1' });
      expect(final).toMatchObject({ orden: 4, rol: 'assistant', contenido: 'Hay uno a $25.000' });
    });

    it('con conversacionId el modelo ve lo anterior, incluidos los pedidos de herramientas (para confirmar una venta)', async () => {
      const llamada = pide('v1', 'registrar_venta', { lineas: [{ repuestoId: 'r1', cantidad: 1 }], confirmado: false });
      completar
        .mockResolvedValueOnce(pideHerramientas(llamada))
        .mockResolvedValueOnce(textoFinal('Total $25.000. ¿Confirma?'));
      const primera = await agente.responder('quiero el filtro');

      completar.mockResolvedValueOnce(textoFinal('Listo, venta V-000001'));
      const segunda = await agente.responder('sí, confirmo', primera.conversacionId);

      expect(segunda.conversacionId).toBe(primera.conversacionId);
      expect(vistoEn(2).slice(1)).toEqual([
        { role: 'user', content: 'quiero el filtro' },
        { role: 'assistant', content: null, tool_calls: [llamada] },
        { role: 'tool', tool_call_id: 'v1', content: expect.any(String) },
        { role: 'assistant', content: 'Total $25.000. ¿Confirma?' },
        { role: 'user', content: 'sí, confirmo' },
      ]);
      expect(conversaciones.filas.map((m) => m.orden)).toEqual([1, 2, 3, 4, 5, 6]);
    });

    it('si el historial es largo, la ventana empieza en un mensaje del cliente', async () => {
      const id = '11111111-1111-4111-8111-111111111111';
      // Conversación anterior: 1 mensaje del cliente seguido de muchos resultados de herramientas.
      const viejo = (orden: number, rol: 'user' | 'tool' | 'assistant') =>
        new MensajeConversacion({
          id: `m${orden}`, conversacionId: id, orden, rol, contenido: `${rol} ${orden}`,
          llamadas: null, llamadaId: rol === 'tool' ? 'x' : null, creadoEn: new Date(),
        });
      conversaciones.filas.push(viejo(1, 'user'));
      for (let o = 2; o <= LIMITE_HISTORIAL + 4; o++) conversaciones.filas.push(viejo(o, 'tool'));
      conversaciones.filas.push(viejo(LIMITE_HISTORIAL + 5, 'user'), viejo(LIMITE_HISTORIAL + 6, 'assistant'));
      completar.mockResolvedValueOnce(textoFinal('ok'));

      await agente.responder('otra pregunta', id);

      // La ventana de 30 empieza con resultados sueltos: se descartan hasta el primer mensaje del cliente.
      expect(vistoEn(0).slice(1).map((m) => m.role)).toEqual(['user', 'assistant', 'user']);
      expect(conversaciones.filas.at(-1)?.orden).toBe(LIMITE_HISTORIAL + 8);
    });

    it('con un conversacionId que no existe responde NotFoundError y no llama al modelo', async () => {
      await expect(agente.responder('hola', '22222222-2222-4222-8222-222222222222')).rejects.toThrow(NotFoundError);
      expect(completar).not.toHaveBeenCalled();
    });

    it('si el modelo falla no guarda nada (el cliente puede reintentar)', async () => {
      completar.mockRejectedValue(new Error('modelo caído'));

      await expect(agente.responder('hola')).rejects.toThrow();
      expect(conversaciones.filas).toEqual([]);
    });
  });
});
