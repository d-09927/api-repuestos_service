import { ConfigService } from '@nestjs/config';
import { McpClienteService } from './mcp-cliente.service';

// Cliente MCP falso: el spec prueba la traducción entre MCP y el modelo, sin red.
const falso = {
  connect: jest.fn(),
  close: jest.fn(),
  listTools: jest.fn(),
  callTool: jest.fn(),
};

jest.mock('@modelcontextprotocol/client', () => ({
  Client: jest.fn(() => falso),
  StreamableHTTPClientTransport: jest.fn(),
}));

const llamada = (name: string, args: string) => ({
  id: 'c1',
  type: 'function' as const,
  function: { name, arguments: args },
});

describe('McpClienteService', () => {
  const servicio = new McpClienteService(new ConfigService({ AGENTE_MCP_TOKEN: 'tk' }));

  beforeEach(() => {
    jest.clearAllMocks();
    falso.listTools.mockResolvedValue({
      tools: [
        {
          name: 'buscar_repuestos',
          description: 'Busca repuestos',
          inputSchema: { type: 'object', properties: { texto: { type: 'string' } } },
        },
      ],
    });
  });

  it('convierte las herramientas del MCP al formato del modelo', async () => {
    const sesion = await servicio.abrir();

    expect(sesion.herramientas).toEqual([
      {
        type: 'function',
        function: {
          name: 'buscar_repuestos',
          description: 'Busca repuestos',
          parameters: { type: 'object', properties: { texto: { type: 'string' } } },
        },
      },
    ]);
  });

  it('ejecuta la herramienta con los argumentos ya convertidos de texto a objeto', async () => {
    falso.callTool.mockResolvedValue({ content: [{ type: 'text', text: '{"items":[]}' }] });
    const sesion = await servicio.abrir();

    const r = await sesion.ejecutar(llamada('buscar_repuestos', '{"texto":"filtro"}'));

    expect(falso.callTool).toHaveBeenCalledWith({ name: 'buscar_repuestos', arguments: { texto: 'filtro' } });
    expect(r).toBe('{"items":[]}');
  });

  it('marca con ERROR los errores de negocio para que el modelo los lea', async () => {
    falso.callTool.mockResolvedValue({ isError: true, content: [{ type: 'text', text: 'No existe: repuesto' }] });
    const sesion = await servicio.abrir();

    expect(await sesion.ejecutar(llamada('obtener_repuesto', '{"id":"x"}'))).toBe('ERROR: No existe: repuesto');
  });

  it('no llama al MCP si los argumentos no son JSON', async () => {
    const sesion = await servicio.abrir();

    const r = await sesion.ejecutar(llamada('buscar_repuestos', '{texto: filtro'));

    expect(r).toMatch(/^ERROR: los argumentos no son un JSON válido/);
    expect(falso.callTool).not.toHaveBeenCalled();
  });

  it('si el MCP lanza (herramienta inexistente, red) devuelve el error como texto', async () => {
    falso.callTool.mockRejectedValue(new Error('Tool inventada not found'));
    const sesion = await servicio.abrir();

    expect(await sesion.ejecutar(llamada('inventada', '{}'))).toBe('ERROR: Tool inventada not found');
  });
});
