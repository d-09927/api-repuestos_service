import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { api } from '../api-client.js';
import { conManejo } from '../resultado.js';
import { paginacion, paginar, SOLO_LECTURA } from './comunes.js';

export function registrarPersonas(server: McpServer) {
  server.registerTool(
    'buscar_proveedores',
    {
      title: 'Buscar proveedores',
      description: 'Busca proveedores por nombre o NIT. Devuelve id, NIT, nombre y datos de contacto.',
      inputSchema: {
        texto: z.string().optional().describe('Parte del nombre o del NIT.'),
        ...paginacion,
      },
      annotations: SOLO_LECTURA,
    },
    (args) => conManejo(() => api('GET', '/proveedores', { query: { ...args, ...paginar(args) } })),
  );

  server.registerTool(
    'buscar_clientes',
    {
      title: 'Buscar clientes',
      description: 'Busca clientes por nombre o número de documento. Devuelve id, tipo y número de documento, nombre y contacto.',
      inputSchema: {
        texto: z.string().optional().describe('Parte del nombre o del documento.'),
        ...paginacion,
      },
      annotations: SOLO_LECTURA,
    },
    (args) => conManejo(() => api('GET', '/clientes', { query: { ...args, ...paginar(args) } })),
  );
}
