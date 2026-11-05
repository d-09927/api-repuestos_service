import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { fechaColombiaIso } from '../../common/fechas';
import type { Servicios } from '../herramienta';
import { SOLO_LECTURA, seguro } from './comunes';

// Lo único que ve AutoMax (concesionario) con su token, para la regla 4 de la garantía. Es una
// excepción a "todo por el agente": corre mientras el taller espera y debe responder en menos de
// 3 s, y el modelo tarda de 10 a 25 s. Es solo lectura y no devuelve datos personales.

const MAX_COMPRAS = 100;

export function registrarGarantias(servidor: McpServer, { ventas }: Servicios) {
  servidor.registerTool(
    'consultar_compras_vin',
    {
      title: 'Consultar compras de repuestos de un vehículo',
      description:
        'Repuestos de una categoría que se vendieron para un VIN, los más recientes primero (máximo 100). ' +
        'AutoMax la usa para decidir la garantía: si se compró un repuesto de ese componente, se cambió por fuera.',
      inputSchema: z.object({
        vin: z.string().describe('VIN del vehículo: 17 caracteres, sin I, O ni Q'),
        categoria: z.string().describe('frenos | suspension | motor | electrico | transmision'),
        codigo_repuesto: z.string().optional().describe('Si viene, solo ese código universal; por ejemplo: PAS-DEL-CER'),
      }),
      annotations: SOLO_LECTURA,
    },
    ({ vin, categoria, codigo_repuesto }) =>
      seguro(async () => {
        const compras = await ventas.comprasPorVin({ vin, categoria, codigoRepuesto: codigo_repuesto });
        return {
          compras: compras.slice(0, MAX_COMPRAS).map((c) => ({
            fecha: fechaColombiaIso(c.fecha),
            codigo_repuesto: c.codigoRepuesto,
            categoria: c.categoria,
            descripcion: c.descripcion,
            cantidad: c.cantidad,
            origen: c.codigoOrden ? 'orden_taller' : 'mostrador',
            codigo_orden: c.codigoOrden,
          })),
        };
      }),
  );
}
