import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { toClienteResponse } from '../../clientes/infrastructure/http/cliente.response';
import { toProveedorResponse } from '../../proveedores/infrastructure/http/proveedor.response';
import type { Servicios } from '../herramienta';
import { paginacion, paginar, seguro, SOLO_LECTURA } from './comunes';

export function registrarPersonas(servidor: McpServer, { proveedores, clientes }: Servicios) {
  servidor.registerTool(
    'buscar_proveedores',
    {
      title: 'Buscar proveedores',
      description: 'Busca proveedores por nombre o NIT. Devuelve id, NIT, nombre y datos de contacto.',
      inputSchema: z.object({
        texto: z.string().optional().describe('Parte del nombre o del NIT'),
        ...paginacion,
      }),
      annotations: SOLO_LECTURA,
    },
    (args) =>
      seguro(async () => {
        const pagina = await proveedores.listar({ ...args, ...paginar(args) });
        return { ...pagina, items: pagina.items.map(toProveedorResponse) };
      }),
  );

  servidor.registerTool(
    'buscar_clientes',
    {
      title: 'Buscar clientes',
      description:
        'Busca clientes por nombre o número de documento. Devuelve id, tipo y número de documento, nombre y contacto.',
      inputSchema: z.object({
        texto: z.string().optional().describe('Parte del nombre o del documento'),
        ...paginacion,
      }),
      annotations: SOLO_LECTURA,
    },
    (args) =>
      seguro(async () => {
        const pagina = await clientes.listar({ ...args, ...paginar(args) });
        return { ...pagina, items: pagina.items.map(toClienteResponse) };
      }),
  );
}