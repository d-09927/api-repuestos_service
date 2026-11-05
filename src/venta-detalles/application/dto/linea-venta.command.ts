export interface LineaVentaCommand {
  ventaId: string;
  repuestoId: string;
  sku: string;
  nombre: string;
  codigoUniversal?: string | null;
  categoria?: string | null;
  cantidad: number;
  precioUnitario: number;
}
