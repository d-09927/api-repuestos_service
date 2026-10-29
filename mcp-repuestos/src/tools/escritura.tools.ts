import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { api } from '../api-client.js';
import { conManejo } from '../resultado.js';
import { uuid } from './comunes.js';

/**
 * Herramientas que MODIFICAN datos. Solo se registran con MCP_PERMITIR_ESCRITURA=true.
 * Todas exigen `confirmado`: con false (o sin enviarlo) no ejecutan nada y devuelven un
 * resumen para mostrárselo al usuario; solo con true se llama a la API.
 */
const ESCRITURA = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false } as const;

const confirmado = z
  .boolean()
  .describe(
    'false para ver primero un resumen sin ejecutar nada. Envía true SOLO después de mostrarle el resumen al usuario ' +
      'y que él confirme de forma explícita ("sí", "confirmo"). Nunca lo pongas en true por tu cuenta.',
  );

const AVISO =
  'Muéstrale este resumen al usuario y pregúntale si confirma. Solo si responde que sí, vuelve a llamar a la herramienta con los mismos datos y confirmado=true.';

const BODEGA = z.string().min(1).max(50).optional().describe('Bodega. Por defecto PRINCIPAL.');
const cantidad = z.number().int().positive().describe('Unidades (entero mayor que 0).');

interface RepuestoApi {
  id: string;
  sku: string;
  nombre: string;
  precio: number;
  activo: boolean;
}
interface StockApi {
  totalDisponible: number;
}

const redondear = (n: number) => Math.round(n * 100) / 100;

export function registrarEscritura(server: McpServer) {
  server.registerTool(
    'reservar_repuesto',
    {
      title: 'Reservar repuesto',
      description:
        'Aparta unidades de un repuesto (no las descuenta del stock físico, solo del disponible), por ejemplo para una orden de taller. ' +
        'Requiere confirmación del usuario.',
      inputSchema: {
        repuestoId: uuid('Id del repuesto.'),
        cantidad,
        bodega: BODEGA,
        motivo: z.string().max(200).optional().describe('Para qué se reserva.'),
        referencia: z.string().max(100).optional().describe('Documento de origen (p. ej. OT-100).'),
        confirmado,
      },
      annotations: ESCRITURA,
    },
    (args) =>
      conManejo(async () => {
        const { confirmado: ok, ...datos } = args;
        const cuerpo = { ...datos, bodega: datos.bodega ?? 'PRINCIPAL', referencia: datos.referencia ?? 'agente-mcp' };
        if (!ok) {
          const r = await api<RepuestoApi>('GET', `/repuestos/${datos.repuestoId}`);
          const s = await api<StockApi>('GET', `/stock/repuestos/${datos.repuestoId}`);
          return {
            requiereConfirmacion: true,
            accion: 'Reservar',
            resumen: { repuesto: `${r.sku} - ${r.nombre}`, cantidad: datos.cantidad, bodega: cuerpo.bodega, disponibleActual: s.totalDisponible },
            instruccion: AVISO,
          };
        }
        return { ejecutado: true, stock: await api('POST', '/stock/reservas', { body: cuerpo }) };
      }),
  );

  server.registerTool(
    'liberar_reserva',
    {
      title: 'Liberar reserva',
      description: 'Devuelve a disponible unidades que estaban reservadas. Requiere confirmación del usuario.',
      inputSchema: {
        repuestoId: uuid('Id del repuesto.'),
        cantidad,
        bodega: BODEGA,
        motivo: z.string().max(200).optional().describe('Por qué se libera.'),
        referencia: z.string().max(100).optional().describe('Documento de origen.'),
        confirmado,
      },
      annotations: ESCRITURA,
    },
    (args) =>
      conManejo(async () => {
        const { confirmado: ok, ...datos } = args;
        const cuerpo = { ...datos, bodega: datos.bodega ?? 'PRINCIPAL', referencia: datos.referencia ?? 'agente-mcp' };
        if (!ok) {
          const r = await api<RepuestoApi>('GET', `/repuestos/${datos.repuestoId}`);
          return {
            requiereConfirmacion: true,
            accion: 'Liberar reserva',
            resumen: { repuesto: `${r.sku} - ${r.nombre}`, cantidad: datos.cantidad, bodega: cuerpo.bodega },
            instruccion: AVISO,
          };
        }
        return { ejecutado: true, stock: await api('POST', '/stock/reservas/liberar', { body: cuerpo }) };
      }),
  );

  server.registerTool(
    'registrar_venta',
    {
      title: 'Registrar venta',
      description:
        'Registra una venta y DESCUENTA las unidades del stock. El precio se toma del catálogo (no se envía). ' +
        'Es todo o nada: si una línea no alcanza en stock, no se vende nada. El cliente es opcional (venta de mostrador). ' +
        'Requiere confirmación del usuario.',
      inputSchema: {
        clienteId: uuid('Id del cliente (usa buscar_clientes).').optional(),
        bodega: BODEGA,
        observaciones: z.string().max(500).optional(),
        lineas: z
          .array(z.object({ repuestoId: uuid('Id del repuesto.'), cantidad }))
          .min(1)
          .max(50)
          .describe('Repuestos a vender.'),
        confirmado,
      },
      annotations: ESCRITURA,
    },
    (args) =>
      conManejo(async () => {
        const { confirmado: ok, ...datos } = args;
        const cuerpo = { ...datos, observaciones: datos.observaciones ?? 'Registrada por agente' };
        if (!ok) {
          const lineas = await Promise.all(
            datos.lineas.map(async (l) => {
              const r = await api<RepuestoApi>('GET', `/repuestos/${l.repuestoId}`);
              const s = await api<StockApi>('GET', `/stock/repuestos/${l.repuestoId}`);
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
            resumen: { clienteId: datos.clienteId ?? 'sin cliente (mostrador)', lineas, total: redondear(lineas.reduce((t, l) => t + l.subtotal, 0)) },
            advertencia: lineas.some((l) => !l.alcanza) ? 'Alguna línea no alcanza en stock o el repuesto está inactivo: la venta será rechazada.' : undefined,
            instruccion: AVISO,
          };
        }
        return { ejecutado: true, venta: await api('POST', '/ventas', { body: cuerpo }) };
      }),
  );

  server.registerTool(
    'registrar_compra',
    {
      title: 'Registrar compra a proveedor',
      description:
        'Registra una compra a un proveedor y SUMA las unidades al stock. Cada línea lleva el costo unitario en pesos. ' +
        'Requiere confirmación del usuario.',
      inputSchema: {
        proveedorId: uuid('Id del proveedor (usa buscar_proveedores).'),
        bodega: BODEGA,
        numeroFacturaProveedor: z.string().max(60).optional().describe('Número de la factura del proveedor.'),
        observaciones: z.string().max(500).optional(),
        lineas: z
          .array(
            z.object({
              repuestoId: uuid('Id del repuesto.'),
              cantidad,
              costoUnitario: z.number().min(0).describe('Costo por unidad en pesos (máximo 2 decimales).'),
            }),
          )
          .min(1)
          .max(50)
          .describe('Repuestos comprados.'),
        confirmado,
      },
      annotations: ESCRITURA,
    },
    (args) =>
      conManejo(async () => {
        const { confirmado: ok, ...datos } = args;
        const cuerpo = { ...datos, observaciones: datos.observaciones ?? 'Registrada por agente' };
        if (!ok) {
          const lineas = await Promise.all(
            datos.lineas.map(async (l) => {
              const r = await api<RepuestoApi>('GET', `/repuestos/${l.repuestoId}`);
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
        return { ejecutado: true, compra: await api('POST', '/compras', { body: cuerpo }) };
      }),
  );
}
