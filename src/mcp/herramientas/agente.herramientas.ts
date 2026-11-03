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
        'Puerta de entrada para los agentes de otros sectores (facturación, taller). Escríbale en español lo que necesita y ' +
        'el agente de repuestos decide qué hacer: decir qué repuestos tenemos ("¿Qué repuestos de frenos tienen?"), cotizar ("Cotiza 2 AMO-DEL-GAS y 1 PAS-DEL-CER"), apartar ("El cliente ' +
        'aceptó: aparta 2 AMO-DEL-GAS"), entregar ("Terminamos: se usaron 2 AMO-DEL-GAS"), cancelar ("Cancela el pedido") ' +
        'o registrar el pago ("Pagamos los repuestos, referencia PSE-123"). Envíe siempre codigo_orden, y un id_mensaje ' +
        'único por intención para apartar, entregar, cancelar o pagar. Responde texto, datos (cotizaciones, precio_unitario ' +
        'SIN IVA), catalogo (los repuestos disponibles, uno por código) y pedido (estado del pedido de la orden), tal como salen del inventario. Puede tardar varios segundos.',
      inputSchema: z.object({
        mensaje: z.string().trim().min(1).max(4000).describe('Lo que necesita, en español. Use los códigos universales del taller.'),
        codigo_orden: z
          .string()
          .trim()
          .max(50)
          .optional()
          .describe('Código de la orden de taller; por ejemplo: OT-0054. Obligatorio para apartar, entregar, cancelar o pagar.'),
        conversacion_id: z.uuid().optional().describe('El conversacion_id de una respuesta anterior, para continuar esa conversación'),
        id_mensaje: z
          .string()
          .max(120)
          .optional()
          .describe(
            'Identificador único de esta intención. En un reintento envíe el mismo: no se aparta, entrega ni cobra dos veces.',
          ),
      }),
      // Puede apartar, entregar o cobrar (según lo que decida el agente): no es de solo lectura.
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async ({ mensaje, codigo_orden, conversacion_id, id_mensaje }) => {
      try {
        const texto = codigo_orden ? `[Orden ${codigo_orden}] ${mensaje}` : mensaje;
        const r = await agente.responder(texto, conversacion_id, 'agente', { codigoOrden: codigo_orden, idMensaje: id_mensaje });
        return resultado({
          conversacion_id: r.conversacionId,
          respuesta: r.respuesta,
          datos: r.datos ?? [],
          catalogo: r.catalogo ?? null,
          pedido: r.pedido ?? null,
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
