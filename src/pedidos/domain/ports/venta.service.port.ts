import { VentaDelPedido } from '../entities/pedido.entity';

export interface VentaPorCobrar {
  clienteId: string;
  bodega: string;
  observaciones: string;
  lineas: { repuestoId: string; cantidad: number }[];
}

/** PUERTO hacia el módulo de ventas. */
export abstract class VentaServicePort {
  /** Registra la venta de lo entregado, con las unidades que estaban reservadas, en estado PENDIENTE_PAGO. */
  abstract registrarPorCobrar(venta: VentaPorCobrar): Promise<VentaDelPedido>;
  abstract marcarPagada(ventaId: string, referenciaPago: string): Promise<void>;
}
