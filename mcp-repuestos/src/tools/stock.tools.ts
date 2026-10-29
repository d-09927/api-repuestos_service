import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { api } from '../api-client.js';
import { conManejo } from '../resultado.js';
import { paginacion, paginar, SOLO_LECTURA, uuid } from './comunes.js';

interface Pagina<T> {
  items: T[];
  total: number;
}
interface RepuestoApi {
  id: string;
  sku: string;
  nombre: string;
  marca: string;
  precio: number;
}
interface StockApi {
  totalFisico: number;
  totalDisponible: number;
  bodegas: { bodega: string; cantidad: number; reservada: number; disponible: number; ubicacion?: string }[];
}

export function registrarStock(server: McpServer) {
  server.registerTool(
    'consultar_stock',
    {
      title: 'Consultar stock de un repuesto',
      description:
        'Existencias de un repuesto en todas las bodegas: total físico, total disponible (físico menos reservado) ' +
        'y el detalle por bodega. Necesita el id del repuesto (se obtiene con buscar_repuestos).',
      inputSchema: { repuestoId: uuid('Id del repuesto.') },
      annotations: SOLO_LECTURA,
    },
    ({ repuestoId }) => conManejo(() => api('GET', `/stock/repuestos/${repuestoId}`)),
  );

  server.registerTool(
    'disponibilidad_repuestos',
    {
      title: 'Disponibilidad de repuestos',
      description:
        'Busca repuestos (por texto o por vehículo) y devuelve de una vez su precio y cuántas unidades hay disponibles. ' +
        'Es la mejor herramienta para preguntas como "¿tienen filtro de aceite para un Spark 2018?". ' +
        'Devuelve como máximo 10 repuestos.',
      inputSchema: {
        texto: z.string().optional().describe('Parte del nombre, SKU o descripción.'),
        vehiculoMarca: z.string().optional().describe('Marca del vehículo.'),
        vehiculoModelo: z.string().optional().describe('Modelo del vehículo.'),
        vehiculoAnio: z.number().int().min(1900).max(2100).optional().describe('Año del vehículo.'),
      },
      annotations: SOLO_LECTURA,
    },
    (args) =>
      conManejo(async () => {
        const encontrados = await api<Pagina<RepuestoApi>>('GET', '/repuestos', {
          query: { ...args, pagina: 1, limite: 10 },
        });
        const items = await Promise.all(
          encontrados.items.map(async (r) => {
            const stock = await api<StockApi>('GET', `/stock/repuestos/${r.id}`);
            return {
              id: r.id,
              sku: r.sku,
              nombre: r.nombre,
              marca: r.marca,
              precio: r.precio,
              disponible: stock.totalDisponible,
              bodegas: stock.bodegas.map((b) => ({ bodega: b.bodega, disponible: b.disponible })),
            };
          }),
        );
        return { total: encontrados.total, mostrados: items.length, items };
      }),
  );

  server.registerTool(
    'stock_bajo',
    {
      title: 'Repuestos con stock bajo',
      description: 'Lista lo que hay que reponer: repuestos cuyo disponible llegó o bajó del mínimo configurado.',
      inputSchema: {},
      annotations: SOLO_LECTURA,
    },
    () => conManejo(() => api('GET', '/stock/stock-bajo')),
  );

  server.registerTool(
    'consultar_movimientos',
    {
      title: 'Historial de movimientos de stock',
      description:
        'Historial de entradas, salidas, reservas y ajustes, del más reciente al más antiguo. ' +
        'Filtra por repuesto y/o bodega. La referencia indica el documento de origen (C-000001 compra, V-000001 venta).',
      inputSchema: {
        repuestoId: uuid('Id del repuesto.').optional(),
        bodega: z.string().optional().describe('Nombre de la bodega (p. ej. PRINCIPAL).'),
        ...paginacion,
      },
      annotations: SOLO_LECTURA,
    },
    (args) => conManejo(() => api('GET', '/stock/movimientos', { query: { ...args, ...paginar(args) } })),
  );
}
