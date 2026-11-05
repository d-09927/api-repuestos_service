/** Entidad de dominio: una línea de venta (un repuesto, una cantidad y su precio). */
export class VentaDetalle {
  id: string;
  ventaId: string;
  repuestoId: string;
  /** SKU, nombre y precio se copian: la venta conserva lo que se vendió y a cuánto. */
  sku: string;
  nombre: string;
  /** También se copian: la garantía pregunta qué componente se vendió, aunque el catálogo cambie. */
  codigoUniversal: string | null;
  categoria: string | null;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;

  constructor(datos: VentaDetalle) {
    Object.assign(this, datos);
  }
}
