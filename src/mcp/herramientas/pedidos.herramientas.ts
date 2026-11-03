import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { Pedido } from '../../pedidos/domain/entities/pedido.entity';
import type { OpcionesMcp, Servicios } from '../herramienta';
import { SOLO_LECTURA, seguro } from './comunes';
import { desglosarIva } from './cotizacion.herramientas';

// Pedidos de una orden de taller. Las usa nuestro agente cuando un agente de otro sector se lo
// pide por hablar_con_repuestos (el agente fija codigo_orden e id_mensaje desde ese mensaje).
// La confirmación del cliente ya ocurrió del lado de facturación: por eso no llevan `confirmado`.

const ESCRITURA = { readOnlyHint: false, destructiveHint: false, openWorldHint: false } as const;

const codigoOrden = z.string().trim().min(1).max(50).describe('Código de la orden de taller; por ejemplo: OT-0054');
const idMensaje = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .describe('Identificador único de esta intención: un reintento con el mismo no repite la acción');
const lineas = (descripcion: string, minimo: number) =>
  z
    .array(
      z.object({
        codigo_repuesto: z.string().trim().min(1).max(50).describe('Código universal; por ejemplo: AMO-DEL-GAS'),
        cantidad: z.number().int().min(minimo).describe('Unidades'),
      }),
    )
    .max(50)
    .describe(descripcion);

const aComando = (l: { codigo_repuesto: string; cantidad: number }[]) =>
  l.map((x) => ({ codigoUniversal: x.codigo_repuesto, cantidad: x.cantidad }));

/** El pedido como lo ven los otros sectores: snake_case y precios sin IVA (como la cotización). */
export function aRespuestaPedido(p: Pedido, ivaPorcentaje: number) {
  const sinIva = (valor: number) => desglosarIva(valor, ivaPorcentaje).precio_unitario;
  const totalVentas = p.ventas.reduce((t, v) => t + v.total, 0);
  return {
    codigo_orden: p.codigoOrden,
    estado: p.estado,
    lineas: p.lineas.map((l) => ({
      codigo_repuesto: l.codigoUniversal,
      sku: l.sku,
      nombre: l.nombre,
      bodega: l.bodega,
      cantidad_apartada: l.cantidadApartada,
      cantidad_entregada: l.cantidadEntregada,
      precio_unitario: sinIva(l.precioUnitario),
    })),
    ventas: p.ventas.map((v) => ({ numero: v.numero, bodega: v.bodega, total_con_iva: Math.round(v.total), total_sin_iva: sinIva(v.total) })),
    total_a_cobrar_con_iva: Math.round(totalVentas),
    total_a_cobrar_sin_iva: sinIva(totalVentas),
    referencia_pago: p.referenciaPago,
  };
}

export function registrarPedidos(servidor: McpServer, { pedidos }: Servicios, opciones: OpcionesMcp) {
  const responder = (accion: () => Promise<Pedido>) =>
    seguro(async () => aRespuestaPedido(await accion(), opciones.ivaPorcentaje));

  servidor.registerTool(
    'consultar_orden',
    {
      title: 'Consultar el pedido de una orden',
      description:
        'Estado del pedido de repuestos de una orden de taller: qué se apartó (marca y bodega), qué se entregó, ' +
        'las ventas por cobrar y si ya se pagó. Estados: APARTADO, ENTREGADO, PAGADO, CANCELADO.',
      inputSchema: z.object({ codigo_orden: codigoOrden }),
      annotations: SOLO_LECTURA,
    },
    ({ codigo_orden }) => responder(() => pedidos.consultar(codigo_orden)),
  );

  if (!opciones.permitirEscritura) return;

  servidor.registerTool(
    'apartar_para_orden',
    {
      title: 'Apartar repuestos para una orden',
      description:
        'Aparta (reserva) los repuestos de una orden de taller cuando el cliente aceptó la cotización. Por cada código ' +
        'universal la tienda elige la marca más barata que alcance en una misma bodega. Todo o nada: si uno no alcanza, ' +
        'no se aparta ninguno. Un pedido por orden.',
      inputSchema: z.object({
        codigo_orden: codigoOrden,
        lineas: lineas('Repuestos a apartar', 1).min(1),
        id_mensaje: idMensaje,
      }),
      annotations: ESCRITURA,
    },
    ({ codigo_orden, lineas: l, id_mensaje }) =>
      responder(() => pedidos.apartar({ codigoOrden: codigo_orden, idMensaje: id_mensaje, lineas: aComando(l) })),
  );

  servidor.registerTool(
    'entregar_orden',
    {
      title: 'Entregar el pedido de una orden',
      description:
        'Cuando el taller terminó: registra la venta POR COBRAR de lo que realmente se usó (sale de lo apartado) y ' +
        'devuelve a disponible lo que sobró. Envíe en usadas solo lo usado; lo que no venga se toma como 0.',
      inputSchema: z.object({
        codigo_orden: codigoOrden,
        usadas: lineas('Repuestos realmente usados (cantidad 0 o más)', 0),
        id_mensaje: idMensaje,
      }),
      annotations: ESCRITURA,
    },
    ({ codigo_orden, usadas, id_mensaje }) =>
      responder(() => pedidos.entregar({ codigoOrden: codigo_orden, idMensaje: id_mensaje, usadas: aComando(usadas) })),
  );

  servidor.registerTool(
    'cancelar_orden',
    {
      title: 'Cancelar el pedido de una orden',
      description: 'La orden se canceló o el cliente desistió: libera todo lo apartado. Solo si aún no se entregó.',
      inputSchema: z.object({
        codigo_orden: codigoOrden,
        motivo: z.string().max(200).optional().describe('Por qué se cancela'),
        id_mensaje: idMensaje,
      }),
      annotations: ESCRITURA,
    },
    ({ codigo_orden, motivo, id_mensaje }) =>
      responder(() => pedidos.cancelar({ codigoOrden: codigo_orden, idMensaje: id_mensaje, motivo })),
  );

  servidor.registerTool(
    'registrar_pago_orden',
    {
      title: 'Registrar el pago del pedido de una orden',
      description: 'Facturación nos pagó los repuestos entregados de la orden: las ventas por cobrar pasan a pagadas.',
      inputSchema: z.object({
        codigo_orden: codigoOrden,
        referencia_pago: z.string().trim().min(1).max(100).describe('Referencia del pago (PSE, transferencia)'),
        id_mensaje: idMensaje,
      }),
      annotations: ESCRITURA,
    },
    ({ codigo_orden, referencia_pago, id_mensaje }) =>
      responder(() =>
        pedidos.registrarPago({ codigoOrden: codigo_orden, idMensaje: id_mensaje, referenciaPago: referencia_pago }),
      ),
  );
}
