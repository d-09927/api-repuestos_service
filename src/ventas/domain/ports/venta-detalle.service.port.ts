export interface DetalleVentaInfo {
  id: string;
  ventaId: string;
  repuestoId: string;
  sku: string;
  nombre: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
}

export type LineaVentaInfo = Omit<DetalleVentaInfo, 'id' | 'subtotal'>;

/** PUERTO hacia el módulo de venta-detalles (otra tabla). */
export abstract class VentaDetalleServicePort {
  /** Valida y arma las líneas (sin guardarlas). */
  abstract construir(lineas: LineaVentaInfo[]): DetalleVentaInfo[];
  abstract guardar(detalles: DetalleVentaInfo[]): Promise<void>;
  abstract listarPorVentas(ventaIds: string[]): Promise<DetalleVentaInfo[]>;
}
