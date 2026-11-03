import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IaService } from './ia.service';

const respuestaHttp = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });

describe('IaService', () => {
  const ia = new IaService(
    new ConfigService({ IA_URL: 'http://modelo.test/v1', IA_KEY: 'llave', IA_MODELO: 'modelo-x' }),
  );
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    fetchMock = jest.spyOn(global, 'fetch');
  });
  afterEach(() => fetchMock.mockRestore());

  it('envía modelo, mensajes y herramientas, y devuelve las herramientas que pide el modelo', async () => {
    fetchMock.mockResolvedValue(
      respuestaHttp({
        choices: [
          {
            message: {
              content: '',
              tool_calls: [
                { id: 'c1', type: 'function', function: { name: 'buscar_repuestos', arguments: '{"texto":"filtro"}' } },
              ],
            },
          },
        ],
      }),
    );
    const herramienta = { type: 'function' as const, function: { name: 'buscar_repuestos', parameters: { type: 'object' } } };

    const r = await ia.completar([{ role: 'user', content: 'hola' }], [herramienta]);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://modelo.test/v1/chat/completions');
    expect(init.headers.Authorization).toBe('Bearer llave');
    const cuerpo = JSON.parse(init.body);
    expect(cuerpo.model).toBe('modelo-x');
    expect(cuerpo.tools).toEqual([herramienta]);
    expect(r.llamadas[0].function.name).toBe('buscar_repuestos');
    expect(JSON.parse(r.llamadas[0].function.arguments)).toEqual({ texto: 'filtro' });
  });

  it('devuelve el texto cuando el modelo responde sin herramientas', async () => {
    fetchMock.mockResolvedValue(respuestaHttp({ choices: [{ message: { content: 'Hola, ¿en qué le ayudo?' } }] }));

    const r = await ia.completar([{ role: 'user', content: 'hola' }]);

    expect(r).toEqual({ texto: 'Hola, ¿en qué le ayudo?', llamadas: [] });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).tools).toBeUndefined();
  });

  it('si el modelo responde con error HTTP lanza ServiceUnavailableException', async () => {
    fetchMock.mockResolvedValue(respuestaHttp({ error: 'model not found' }, 404));

    await expect(ia.completar([{ role: 'user', content: 'hola' }])).rejects.toThrow(ServiceUnavailableException);
  });

    it('si no hay conexión con el modelo lanza ServiceUnavailableException', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));

    await expect(ia.completar([{ role: 'user', content: 'hola' }])).rejects.toThrow(ServiceUnavailableException);
  });

  it('si la respuesta llegó cortada por falta de contexto lanza ServiceUnavailableException', async () => {
    fetchMock.mockResolvedValue(respuestaHttp({ choices: [{ finish_reason: 'length', message: { content: '' } }] }));

    await expect(ia.completar([{ role: 'user', content: 'hola' }])).rejects.toThrow(/sin contexto/);
  });
});




