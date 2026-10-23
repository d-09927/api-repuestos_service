/** El precio no se envía: se toma del catálogo en el momento de la venta. */
export interface LineaVentaRegistroCommand {
  repuestoId: string;
  cantidad: number;
}

export interface CreateVentaCommand {
  /** Opcional: una venta de mostrador puede no tener cliente. */
  clienteId?: string;
  /** Bodega de la que salen los repuestos. Si no se indica, PRINCIPAL. */
  bodega?: string;
  observaciones?: string;
  lineas: LineaVentaRegistroCommand[];
}
