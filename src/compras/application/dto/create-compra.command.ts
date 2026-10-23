export interface LineaCompraRegistroCommand {
  repuestoId: string;
  cantidad: number;
  costoUnitario: number;
}

export interface CreateCompraCommand {
  proveedorId: string;
  /** Bodega donde entra la mercancía. Si no se indica, PRINCIPAL. */
  bodega?: string;
  numeroFacturaProveedor?: string;
  observaciones?: string;
  lineas: LineaCompraRegistroCommand[];
}
