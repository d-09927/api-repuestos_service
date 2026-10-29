import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { api } from '../api-client.js';
import { conManejo } from '../resultado.js';
import { fechaDia, paginacion, paginar, SOLO_LECTURA, uuid } from './comunes.js';

export function registrarDocumentos(server: McpServer) {
  server.registerTool(
    'consultar_ventas',
    {
      title: 'Consultar ventas',
      description:
        'Lista las ventas (más recientes primero) con su número V-xxxxxx, cliente, total en pesos y fecha. ' +
        'Filtra por cliente y/o rango de fechas; "hasta" incluye todo ese día. Para ver las líneas usa obtener_venta.',
      inputSchema: {
        clienteId: uuid('Id del cliente.').optional(),
        desde: fechaDia('Desde esta fecha.').optional(),
        hasta: fechaDia('Hasta esta fecha (incluida).').optional(),
        ...paginacion,
      },
      annotations: SOLO_LECTURA,
    },
    (args) => conManejo(() => api('GET', '/ventas', { query: { ...args, ...paginar(args) } })),
  );

  server.registerTool(
    'obtener_venta',
    {
      title: 'Obtener una venta',
      description: 'Detalle de una venta con todas sus líneas (repuesto, cantidad, precio unitario y subtotal).',
      inputSchema: { id: uuid('Id de la venta.') },
      annotations: SOLO_LECTURA,
    },
    ({ id }) => conManejo(() => api('GET', `/ventas/${id}`)),
  );

  server.registerTool(
    'consultar_compras',
    {
      title: 'Consultar compras a proveedores',
      description:
        'Lista las compras a proveedores (más recientes primero) con su número C-xxxxxx, proveedor, total y fecha. ' +
        'Filtra por proveedor y/o rango de fechas; "hasta" incluye todo ese día. Para ver las líneas usa obtener_compra.',
      inputSchema: {
        proveedorId: uuid('Id del proveedor.').optional(),
        desde: fechaDia('Desde esta fecha.').optional(),
        hasta: fechaDia('Hasta esta fecha (incluida).').optional(),
        ...paginacion,
      },
      annotations: SOLO_LECTURA,
    },
    (args) => conManejo(() => api('GET', '/compras', { query: { ...args, ...paginar(args) } })),
  );

  server.registerTool(
    'obtener_compra',
    {
      title: 'Obtener una compra',
      description: 'Detalle de una compra con todas sus líneas (repuesto, cantidad, costo unitario y subtotal).',
      inputSchema: { id: uuid('Id de la compra.') },
      annotations: SOLO_LECTURA,
    },
    ({ id }) => conManejo(() => api('GET', `/compras/${id}`)),
  );
}
