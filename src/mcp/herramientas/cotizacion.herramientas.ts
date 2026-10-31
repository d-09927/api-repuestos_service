import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import type { OpcionesMcp, Servicios } from '../herramienta';
import { SOLO_LECTURA, seguro } from './comunes';

// Herramientas para los otros sectores (facturación). Usan los nombres en snake_case y los
// códigos universales del contrato del taller (PAS-DEL-CER), no nuestro SKU interno.

/** Un repuesto nuestro que tiene el código universal pedido. */
export interface Candidato {
  sku: string;
  nombre: string;
  marca: string;
  /** Precio de catálogo en pesos, con IVA incluido. */
  precio: number;
  disponible: number;
  bodegas: { bodega: string; disponible: number }[];
}

/**
 * Cuál ofrecer primero cuando varias marcas comparten el código: las que alcanzan para la
 * cantidad pedida, de la más barata a la más cara; después las que no alcanzan, las de más
 * unidades primero.
 */
export function ordenarOfertas(candidatos: Candidato[], cantidad: number): Candidato[] {
  return [...candidatos].sort((a, b) => {
    const alcanzaA = a.disponible >= cantidad;
    const alcanzaB = b.disponible >= cantidad;
    if (alcanzaA !== alcanzaB) return alcanzaA ? -1 : 1;
    if (alcanzaA) return a.precio - b.precio || b.disponible - a.disponible;
    return b.disponible - a.disponible || a.precio - b.precio;
  });
}

/**
 * El precio de catálogo ya trae IVA, pero facturación calcula su propio IVA: precio_unitario va
 * SIN IVA (la base) y el precio con IVA y el IVA van aparte, como referencia.
 */
export function desglosarIva(precioConIva: number, ivaPorcentaje: number) {
  const conIva = Math.round(precioConIva);
  const sinIva = Math.round(conIva / (1 + ivaPorcentaje / 100));
  return { precio_unitario: sinIva, precio_unitario_con_iva: conIva, iva_unitario: conIva - sinIva };
}

export function registrarCotizacion(servidor: McpServer, { repuestos, stock }: Servicios, opciones: OpcionesMcp) {
  servidor.registerTool(
    'consultar_precio_repuesto',
    {
      title: 'Consultar precio de un repuesto (para facturación)',
      description:
        'Dado un código universal de repuesto (el del catálogo del taller, por ejemplo PAS-DEL-CER) y una cantidad, ' +
        'devuelve la tienda, el precio unitario en pesos (entero, SIN IVA; el precio con IVA y el IVA vienen aparte) ' +
        'y si hay unidades suficientes, con el detalle por bodega. Si tenemos varias marcas con ese código, ofrece la más ' +
        'barata que alcance y lista las demás en alternativas. Solo lectura: no aparta unidades.',
      inputSchema: z.object({
        codigo_repuesto: z.string().trim().min(1).max(50).describe('Código universal del repuesto; por ejemplo: PAS-DEL-CER'),
        cantidad: z.number().int().positive().max(10000).describe('Unidades que se necesitan'),
      }),
      annotations: SOLO_LECTURA,
    },
    ({ codigo_repuesto, cantidad }) =>
      seguro(async () => {
        const codigo = codigo_repuesto.trim().toUpperCase();
        const encontrados = await repuestos.listar({ codigoUniversal: codigo, pagina: 1, limite: 50 });
        const candidatos: Candidato[] = await Promise.all(
          encontrados.items.map(async ({ repuesto: r }) => {
            const s = await stock.consultarPorRepuesto(r.id);
            return {
              sku: r.sku,
              nombre: r.nombre,
              marca: r.marca,
              precio: r.precio,
              disponible: s.totalDisponible,
              bodegas: s.bodegas
                .map((b) => ({ bodega: b.bodega, disponible: b.cantidad - b.reservada }))
                .filter((b) => b.disponible > 0),
            };
          }),
        );

        const comun = {
          codigo_repuesto: codigo,
          cantidad,
          tienda: opciones.tienda,
          precio_incluye_iva: false,
          iva_porcentaje: opciones.ivaPorcentaje,
        };
        // No manejarlo es una respuesta válida (no un error): facturación busca en otra tienda.
        if (!candidatos.length) {
          return {
            ...comun,
            disponible: false,
            precio_unitario: null,
            unidades_disponibles: 0,
            mensaje: `La tienda no maneja el repuesto ${codigo}`,
          };
        }

        const [mejor, ...resto] = ordenarOfertas(candidatos, cantidad);
        const disponible = mejor.disponible >= cantidad;
        return {
          ...comun,
          ...desglosarIva(mejor.precio, opciones.ivaPorcentaje),
          disponible,
          unidades_disponibles: mejor.disponible,
          repuesto: { sku: mejor.sku, nombre: mejor.nombre, marca: mejor.marca },
          bodegas: mejor.bodegas,
          alternativas: resto.map((a) => ({
            sku: a.sku,
            nombre: a.nombre,
            marca: a.marca,
            precio_unitario: desglosarIva(a.precio, opciones.ivaPorcentaje).precio_unitario,
            unidades_disponibles: a.disponible,
            disponible: a.disponible >= cantidad,
          })),
          mensaje: disponible
            ? undefined
            : `Solo hay ${mejor.disponible} unidad(es) disponible(s) de ${codigo} y se piden ${cantidad}`,
        };
      }),
  );
}
