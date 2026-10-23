/** Entidad de dominio: una línea de compra (un repuesto, una cantidad y su costo). */
export class CompraDetalle {
  id: string;
  compraId: string;
  repuestoId: string;
  /** SKU y nombre se copian: la compra conserva lo que se compró aunque el catálogo cambie. */
  sku: string;
  nombre: string;
  cantidad: number;
  costoUnitario: number;
  subtotal: number;

  constructor(datos: CompraDetalle) {
    Object.assign(this, datos);
  }
}
