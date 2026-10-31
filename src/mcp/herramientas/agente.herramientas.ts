import { HttpException } from '@nestjs/common';
import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { PUERTA_DEL_AGENTE } from '../../agente/application/agente.service';
import type { Servicios } from '../herramienta';
import { fallo, resultado } from './comunes';

// La puerta de entrada de los agentes de otros sectores: no consultan nuestras herramientas
// directamente, le hablan a nuestro agente y él decide qué consultar (requisito del proyecto).

export function registrarAgente(servidor: McpServer, { agente }: Servicios) {
  servidor.registerTool(
    PUERTA_DEL_AGENTE,
    {
      title: 'Hablar con el agente de repuestos',
      description:
        'Puerta de entrada para los agentes de otros sectores (facturación, taller). Escríbale en español lo que necesita, ' +
        'por ejemplo: "Cotiza 2 AMO-DEL-GAS y 1 PAS-DEL-CER para la OT-0054", y el agente de repuestos decide qué consultar. ' +
        'Responde un texto y, en datos, el precio y la disponibilidad de cada repuesto cotizado tal como salen del inventario ' +
        '(precio_unitario en pesos SIN IVA). Puede tardar varios segundos. Para seguir la misma conversación envíe conversacion_id.',
      inputSchema: z.object({
        mensaje: z.string().trim().min(1).max(4000).describe('Lo que necesita, en español. Use los códigos universales del taller.'),
        codigo_orden: z.string().trim().max(50).optional().describe('Código de la orden de taller, si aplica; por ejemplo: OT-0054'),
        conversacion_id: z.uuid().optional().describe('El conversacion_id de una respuesta anterior, para continuar esa conversación'),
        id_mensaje: z
          .string()
          .max(120)
          .optional()
          .describe('Identificador de esta intención (convención del ecosistema). Hoy solo hay consultas: repetirla no cambia nada.'),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ mensaje, codigo_orden, conversacion_id }) => {
      try {
        const texto = codigo_orden ? `[Orden ${codigo_orden}] ${mensaje}` : mensaje;
        const r = await agente.responder(texto, conversacion_id, 'agente');
        return resultado({
          conversacion_id: r.conversacionId,
          respuesta: r.respuesta,
          datos: r.datos ?? [],
          herramientas_usadas: r.herramientas,
        });
      } catch (error) {
        // El modelo de IA caído no es un error de datos: el otro agente puede reintentar.
        if (error instanceof HttpException && error.getStatus() === 503) {
          return {
            isError: true,
            content: [{ type: 'text' as const, text: `El agente de repuestos no está disponible en este momento: ${error.message}. Reintente.` }],
          };
        }
        return fallo(error);
      }
    },
  );
}
