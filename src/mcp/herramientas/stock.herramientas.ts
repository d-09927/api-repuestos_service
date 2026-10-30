import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { toMovimientoResponse } from '../../movimientos/infrastructure/http/movimiento.response';
import { toRepuestoResponse } from '../../repuestos/infrastructure/http/repuesto.response';
import { toStockResponse } from '../../stock/infrastructure/http/stock.response';
import type { Servicios } from '../herramienta';
import { id, paginacion, paginar, seguro, SOLO_LECTURA } from './comunes';

export function registrarStock(servidor: McpServer, { repuestos, stock, movimientos }: Servicios) {
  servidor.registerTool(
    'consultar_stock',
    {
      title: 'Consultar stock de un repuesto',
      description:
        'Existencias de un repuesto en todas las bodegas: total físico, total disponible (físico menos reservado) ' +
        'y el detalle por bodega. Necesita el id del repuesto, según buscar_repuestos.',
      inputSchema: z.object({ repuestoId: id('Id del repuesto') }),
      annotations: SOLO_LECTURA,
    },
    ({ repuestoId }) =>
      seguro(async () => {
        const consulta = await stock.consultarPorRepuesto(repuestoId);
        return { ...consulta, bodegas: consulta.bodegas.map(toStockResponse) };
      }),
  );

  servidor.registerTool(
    'disponibilidad_repuestos',
    {
      title: 'Disponibilidad de repuestos',
      description:
        'Busca repuestos (por texto o por vehículo) y devuelve de una vez su precio y cuántas unidades hay disponibles. ' +
        'Es la mejor herramienta para preguntas como si hay filtro de aceite para un Spark 2018. ' +
        'Devuelve como máximo 10 repuestos.',
      inputSchema: z.object({
        texto: z.string().optional().describe('Parte del nombre, SKU o descripción'),
        vehiculoMarca: z.string().optional().describe('Marca del vehículo'),
        vehiculoModelo: z.string().optional().describe('Modelo del vehículo'),
        vehiculoAnio: z.number().int().min(1900).max(2100).optional().describe('Año del vehículo'),
      }),
      annotations: SOLO_LECTURA,
    },
    (args) =>
      seguro(async () => {
        const encontrados = await repuestos.listar({ ...args, pagina: 1, limite: 10 });
        const items = await Promise.all(
          encontrados.items.map(async (detalle) => {
            const r = toRepuestoResponse(detalle);
            const s = await stock.consultarPorRepuesto(r.id);
            return {
              id: r.id,
              sku: r.sku,
              nombre: r.nombre,
              marca: r.marca,
              precio: r.precio,
              disponible: s.totalDisponible,
              bodegas: s.bodegas.map((b) => ({ bodega: b.bodega, disponible: b.cantidad - b.reservada })),
            };
          }),
        );
        return { total: encontrados.total, mostrados: items.length, items };
      }),
  );

  servidor.registerTool(
    'stock_bajo',
    {
      title: 'Repuestos con stock bajo',
      description: 'Lista lo que hay que reponer: repuestos cuyo disponible llegó o bajó del mínimo configurado.',
      annotations: SOLO_LECTURA,
    },
    () => seguro(async () => (await stock.stockBajo()).map(toStockResponse)),
  );

  servidor.registerTool(
    'consultar_movimientos',
    {
      title: 'Historial de movimientos de stock',
      description:
        'Historial de entradas, salidas, reservas y ajustes, del más reciente al más antiguo. ' +
        'Filtra por repuesto y/o bodega. La referencia indica el documento de origen: C-000001 es una compra y V-000001 una venta.',
      inputSchema: z.object({
        repuestoId: id('Id del repuesto').optional(),
        bodega: z.string().optional().describe('Nombre de la bodega; por ejemplo: PRINCIPAL'),
        ...paginacion,
      }),
      annotations: SOLO_LECTURA,
    },
    (args) =>
      seguro(async () => {
        const pagina = await movimientos.listar({ ...args, ...paginar(args) });
        return { ...pagina, items: pagina.items.map(toMovimientoResponse) };
      }),
  );
}