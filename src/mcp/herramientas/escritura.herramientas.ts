import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { toCompraResponse } from '../../compras/infrastructure/http/compra.response';
import { toStockResponse } from '../../stock/infrastructure/http/stock.response';
import { toVentaResponse } from '../../ventas/infrastructure/http/venta.response';
import type { Servicios } from '../herramienta';
import { id, seguro } from './comunes';

// Herramientas que MODIFICAN datos. Solo existen si MCP_PERMITIR_ESCRITURA=true (para un
// servidor en solo lectura ni siquiera aparecen). Todas exigen `confirmado`: con false no
// ejecutan nada y devuelven un resumen para mostrárselo al usuario; solo con true llaman al service.

const ESCRITURA = { readOnlyHint: false, destructiveHint: false, openWorldHint: false } as const;

const BODEGA = 'PRINCIPAL';

const confirmado = z
  .boolean()
  .describe(
    'false para ver primero un resumen sin ejecutar nada. Envíe true SOLO después de mostrarle el resumen al usuario ' +
      'y que él confirme de forma explícita (sí, confirmo). Nunca lo ponga en true por su cuenta.',
  );

const AVISO =
  'Muéstrele este resumen al usuario y pregúntele si confirma. Solo si responde que sí, vuelva a llamar a la ' +
  'herramienta con los mismos datos y confirmado=true.';

const bodega = z.string().min(1).max(50).optional().describe(`Bodega; por defecto ${BODEGA}`);
const cantidad = z.number().int().positive().describe('Unidades (entero mayor que 0)');
const redondear = (n: number) => Math.round(n * 100) / 100;

export function registrarEscritura(servidor: McpServer, { repuestos, stock, ventas, compras }: Servicios) {
  servidor.registerTool(
    'reservar_repuesto',
    {
      title: 'Reservar repuesto',
      description:
        'Aparta unidades de un repuesto (no baja el stock físico, solo el disponible), por ejemplo para una orden de taller. ' +
        'Requiere confirmación del usuario.',
      inputSchema: z.object({
        repuestoId: id('Id del repuesto, según buscar_repuestos'),
        cantidad,
        bodega,
        motivo: z.string().max(200).optional().describe('Para qué se reserva'),
        referencia: z.string().max(100).optional().describe('Documento de origen; por ejemplo: OT-100'),
        confirmado,
      }),
      annotations: ESCRITURA,
    },
    ({ confirmado: ok, ...datos }) =>
      seguro(async () => {
        const cmd = { ...datos, bodega: datos.bodega ?? BODEGA, referencia: datos.referencia ?? 'agente-mcp' };
        if (!ok) {
          const r = await repuestos.obtener(datos.repuestoId);
          const s = await stock.consultarPorRepuesto(datos.repuestoId);
          return {
            requiereConfirmacion: true,
            accion: 'Reservar',
            resumen: { repuesto: `${r.sku} - ${r.nombre}`, cantidad: datos.cantidad, bodega: cmd.bodega, disponibleActual: s.totalDisponible },
            instruccion: AVISO,
          };
        }
        return { ejecutado: true, stock: toStockResponse(await stock.reservar(cmd)) };
      }),
  );

  servidor.registerTool(
    'liberar_reserva',
    {
      title: 'Liberar reserva',
      description: 'Devuelve a disponible unidades que estaban reservadas. Requiere confirmación del usuario.',
      inputSchema: z.object({
        repuestoId: id('Id del repuesto'),
        cantidad,
        bodega,
        motivo: z.string().max(200).optional().describe('Por qué se libera'),
        referencia: z.string().max(100).optional().describe('Documento de origen'),
        confirmado,
      }),
      annotations: ESCRITURA,
    },
    ({ confirmado: ok, ...datos }) =>
      seguro(async () => {
        const cmd = { ...datos, bodega: datos.bodega ?? BODEGA, referencia: datos.referencia ?? 'agente-mcp' };
        if (!ok) {
          const r = await repuestos.obtener(datos.repuestoId);
          return {
            requiereConfirmacion: true,
            accion: 'Liberar reserva',
            resumen: { repuesto: `${r.sku} - ${r.nombre}`, cantidad: datos.cantidad, bodega: cmd.bodega },
            instruccion: AVISO,
          };
        }
        return { ejecutado: true, stock: toStockResponse(await stock.liberarReserva(cmd)) };
      }),
  );

  servidor.registerTool(
    'registrar_venta',
    {
      title: 'Registrar venta',
      description:
        'Registra una venta y DESCUENTA las unidades del stock. El precio se toma del catálogo (no se envía). ' +
        'Es todo o nada: si una línea no alcanza en stock, no se vende nada. El cliente es opcional (venta de mostrador). ' +
        'Requiere confirmación del usuario.',
      inputSchema: z.object({
        clienteId: id('Id del cliente, según buscar_clientes').optional(),
        vin: z.string().optional().describe('VIN del vehículo al que va el repuesto (17 caracteres, sin I, O ni Q), tal como lo dio el cliente'),
        bodega,
        observaciones: z.string().max(500).optional(),
        lineas: z
          .array(z.object({ repuestoId: id('Id del repuesto'), cantidad }))
          .min(1)
          .max(50)
          .describe('Repuestos a vender'),
        confirmado,
      }),
      annotations: ESCRITURA,
    },
    ({ confirmado: ok, ...datos }) =>
      seguro(async () => {
        const cmd = { ...datos, observaciones: datos.observaciones ?? 'Registrada por agente' };
        if (!ok) {
          const lineas = await Promise.all(
            datos.lineas.map(async (l) => {
              const r = await repuestos.obtener(l.repuestoId);
              const s = await stock.consultarPorRepuesto(l.repuestoId);
              return {
                repuesto: `${r.sku} - ${r.nombre}`,
                cantidad: l.cantidad,
                precioUnitario: r.precio,
                subtotal: redondear(r.precio * l.cantidad),
                disponible: s.totalDisponible,
                alcanza: r.activo && s.totalDisponible >= l.cantidad,
              };
            }),
          );
          return {
            requiereConfirmacion: true,
            accion: 'Registrar venta',
            resumen: {
              clienteId: datos.clienteId ?? 'sin cliente (mostrador)',
              vin: datos.vin ?? 'sin VIN',
              lineas,
              total: redondear(lineas.reduce((t, l) => t + l.subtotal, 0)),
            },
            advertencia: lineas.some((l) => !l.alcanza)
              ? 'Alguna línea no alcanza en stock o el repuesto está inactivo: la venta será rechazada.'
              : undefined,
            instruccion: AVISO,
          };
        }
        return { ejecutado: true, venta: toVentaResponse(await ventas.registrar(cmd)) };
      }),
  );

  servidor.registerTool(
    'registrar_compra',
    {
      title: 'Registrar compra a proveedor',
      description:
        'Registra una compra a un proveedor y SUMA las unidades al stock. Cada línea lleva el costo unitario en pesos. ' +
        'Requiere confirmación del usuario.',
      inputSchema: z.object({
        proveedorId: id('Id del proveedor, según buscar_proveedores'),
        bodega,
        numeroFacturaProveedor: z.string().max(60).optional().describe('Número de la factura del proveedor'),
        observaciones: z.string().max(500).optional(),
        lineas: z
          .array(
            z.object({
              repuestoId: id('Id del repuesto'),
              cantidad,
              costoUnitario: z.number().min(0).describe('Costo por unidad en pesos (máximo 2 decimales)'),
            }),
          )
          .min(1)
          .max(50)
          .describe('Repuestos comprados'),
        confirmado,
      }),
      annotations: ESCRITURA,
    },
    ({ confirmado: ok, ...datos }) =>
      seguro(async () => {
        const cmd = { ...datos, observaciones: datos.observaciones ?? 'Registrada por agente' };
        if (!ok) {
          const lineas = await Promise.all(
            datos.lineas.map(async (l) => {
              const r = await repuestos.obtener(l.repuestoId);
              return {
                repuesto: `${r.sku} - ${r.nombre}`,
                cantidad: l.cantidad,
                costoUnitario: l.costoUnitario,
                subtotal: redondear(l.costoUnitario * l.cantidad),
              };
            }),
          );
          return {
            requiereConfirmacion: true,
            accion: 'Registrar compra',
            resumen: { proveedorId: datos.proveedorId, lineas, total: redondear(lineas.reduce((t, l) => t + l.subtotal, 0)) },
            instruccion: AVISO,
          };
        }
        return { ejecutado: true, compra: toCompraResponse(await compras.registrar(cmd)) };
      }),
  );
}