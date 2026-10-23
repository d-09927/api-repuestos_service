export interface DetalleCompraInfo {
  id: string;
  compraId: string;
  repuestoId: string;
  sku: string;
  nombre: string;
  cantidad: number;
  costoUnitario: number;
  subtotal: number;
}

export type LineaCompraInfo = Omit<DetalleCompraInfo, 'id' | 'subtotal'>;

/** PUERTO hacia el módulo de compra-detalles (otra tabla). */
export abstract class CompraDetalleServicePort {
  /** Valida y arma las líneas (sin guardarlas). */
  abstract construir(lineas: LineaCompraInfo[]): DetalleCompraInfo[];
  abstract guardar(detalles: DetalleCompraInfo[]): Promise<void>;
  abstract listarPorCompras(compraIds: string[]): Promise<DetalleCompraInfo[]>;
}
