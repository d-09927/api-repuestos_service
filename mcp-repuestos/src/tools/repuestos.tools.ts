import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { api } from '../api-client.js';
import { conManejo } from '../resultado.js';
import { paginacion, paginar, SOLO_LECTURA, uuid } from './comunes.js';

export function registrarRepuestos(server: McpServer) {
  server.registerTool(
    'buscar_repuestos',
    {
      title: 'Buscar repuestos',
      description:
        'Busca repuestos del catálogo por texto (nombre, SKU o descripción), marca o categoría. ' +
        'Devuelve id, sku, nombre, marca, categoría, precio (en pesos) y los vehículos compatibles. ' +
        'No incluye existencias: para saber si hay unidades usa consultar_stock o disponibilidad_repuestos.',
      inputSchema: {
        texto: z.string().optional().describe('Parte del nombre, SKU o descripción.'),
        marca: z.string().optional().describe('Marca del repuesto (Bosch, Mann...).'),
        categoria: z.string().optional().describe('Categoría (Filtros, Frenos...).'),
        ...paginacion,
      },
      annotations: SOLO_LECTURA,
    },
    (args) => conManejo(() => api('GET', '/repuestos', { query: { ...args, ...paginar(args) } })),
  );

  server.registerTool(
    'buscar_repuestos_por_vehiculo',
    {
      title: 'Buscar repuestos por vehículo',
      description:
        'Busca los repuestos compatibles con un vehículo (marca y modelo, y opcionalmente el año). ' +
        'Úsala cuando el cliente pregunta "qué sirve para mi carro".',
      inputSchema: {
        vehiculoMarca: z.string().describe('Marca del vehículo, p. ej. Chevrolet.'),
        vehiculoModelo: z.string().describe('Modelo del vehículo, p. ej. Spark.'),
        vehiculoAnio: z.number().int().min(1900).max(2100).optional().describe('Año del vehículo.'),
        texto: z.string().optional().describe('Filtra además por nombre (p. ej. "filtro de aceite").'),
        ...paginacion,
      },
      annotations: SOLO_LECTURA,
    },
    (args) => conManejo(() => api('GET', '/repuestos', { query: { ...args, ...paginar(args) } })),
  );

  server.registerTool(
    'obtener_repuesto',
    {
      title: 'Obtener un repuesto',
      description: 'Devuelve el detalle de un repuesto por su id, con su compatibilidad de vehículos.',
      inputSchema: { id: uuid('Id del repuesto.') },
      annotations: SOLO_LECTURA,
    },
    ({ id }) => conManejo(() => api('GET', `/repuestos/${id}`)),
  );
}
