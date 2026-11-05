import { EstadoPedido } from '../enums/estado-pedido.enum';

/** Un repuesto apartado para la orden: qué marca y de qué bodega (lo eligió la tienda al apartar). */
export interface LineaPedido {
  codigoUniversal: string;
  repuestoId: string;
  sku: string;
  nombre: string;
  bodega: string;
  /** Precio de catálogo (con IVA) al apartar. La venta toma el del catálogo al entregar. */
  precioUnitario: number;
  cantidadApartada: number;
  cantidadEntregada: number;
}

/** La venta que se generó al entregar (una por bodega). */
export interface VentaDelPedido {
  id: string;
  numero: string;
  bodega: string;
  total: number;
}

/**
 * Entidad de dominio: los repuestos que la tienda le aparta a una orden de taller a pedido de
 * otro sector (facturación). Uno por orden. Las reglas están en PedidosService.
 */
export class Pedido {
  id: string;
  /** Código de la orden de taller (OT-0054). Único. */
  codigoOrden: string;
  /** Vehículo de la orden: pasa a las ventas, que AutoMax consulta para la garantía. */
  vin: string | null;
  estado: EstadoPedido;
  lineas: LineaPedido[];
  ventas: VentaDelPedido[];
  /** id_mensaje ya procesados: un reintento con el mismo devuelve el pedido sin repetir la acción. */
  mensajes: string[];
  referenciaPago: string | null;
  creadoEn: Date;
  actualizadoEn: Date;

  constructor(datos: Pedido) {
    Object.assign(this, datos);
  }
}
