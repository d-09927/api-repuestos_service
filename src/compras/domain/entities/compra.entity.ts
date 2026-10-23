/** Entidad de dominio: cabecera de una compra a un proveedor. Sus líneas están en compra-detalles. */
export class Compra {
  id: string;
  numero: string;
  proveedorId: string;
  bodega: string;
  numeroFacturaProveedor: string | null;
  observaciones: string | null;
  total: number;
  fecha: Date;
  creadoEn: Date;

  constructor(datos: Compra) {
    Object.assign(this, datos);
  }
}
