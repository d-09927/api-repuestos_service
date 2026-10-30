import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { toCompraResponse } from '../../compras/infrastructure/http/compra.response';
import { toVentaResponse } from '../../ventas/infrastructure/http/venta.response';
import type { Servicios } from '../herramienta';
import { fechaDia, id, paginacion, paginar, seguro, SOLO_LECTURA } from './comunes';

export function registrarDocumentos(servidor: McpServer, { ventas, compras }: Servicios) {
  servidor.registerTool(
    'consultar_ventas',
    {
      title: 'Consultar ventas',
      description:
        'Lista las ventas (más recientes primero) con su número V-xxxxxx, cliente, total en pesos y fecha. ' +
        'Filtra por cliente y/o rango de fechas; hasta incluye todo ese día. Para ver las líneas use obtener_venta.',
      inputSchema: z.object({
        clienteId: id('Id del cliente, según buscar_clientes').optional(),
        desde: fechaDia('Desde esta fecha.').optional(),
        hasta: fechaDia('Hasta esta fecha (incluida).').optional(),
        ...paginacion,
      }),
      annotations: SOLO_LECTURA,
    },
    (args) =>
      seguro(async () => {
        const pagina = await ventas.listar({ ...args, ...paginar(args) });
        return { ...pagina, items: pagina.items.map(toVentaResponse) };
      }),
  );

  servidor.registerTool(
    'obtener_venta',
    {
      title: 'Obtener una venta',
      description: 'Detalle de una venta con todas sus líneas (repuesto, cantidad, precio unitario y subtotal).',
      inputSchema: z.object({ id: id('Id de la venta') }),
      annotations: SOLO_LECTURA,
    },
    ({ id }) => seguro(async () => toVentaResponse(await ventas.obtener(id))),
  );

  servidor.registerTool(
    'consultar_compras',
    {
      title: 'Consultar compras a proveedores',
      description:
        'Lista las compras a proveedores (más recientes primero) con su número C-xxxxxx, proveedor, total y fecha. ' +
        'Filtra por proveedor y/o rango de fechas; hasta incluye todo ese día. Para ver las líneas use obtener_compra.',
      inputSchema: z.object({
        proveedorId: id('Id del proveedor, según buscar_proveedores').optional(),
        desde: fechaDia('Desde esta fecha.').optional(),
        hasta: fechaDia('Hasta esta fecha (incluida).').optional(),
        ...paginacion,
      }),
      annotations: SOLO_LECTURA,
    },
    (args) =>
      seguro(async () => {
        const pagina = await compras.listar({ ...args, ...paginar(args) });
        return { ...pagina, items: pagina.items.map(toCompraResponse) };
      }),
  );

  servidor.registerTool(
    'obtener_compra',
    {
      title: 'Obtener una compra',
      description: 'Detalle de una compra con todas sus líneas (repuesto, cantidad, costo unitario y subtotal).',
      inputSchema: z.object({ id: id('Id de la compra') }),
      annotations: SOLO_LECTURA,
    },
    ({ id }) => seguro(async () => toCompraResponse(await compras.obtener(id))),
  );
}