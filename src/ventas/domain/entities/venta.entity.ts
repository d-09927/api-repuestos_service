/** Entidad de dominio: cabecera de una venta. Sus líneas están en venta-detalles. */
export class Venta {
  id: string;
  numero: string;
  /** Opcional: una venta de mostrador puede no tener cliente registrado. */
  clienteId: string | null;
  bodega: string;
  observaciones: string | null;
  total: number;
  fecha: Date;
  creadoEn: Date;

  constructor(datos: Venta) {
    Object.assign(this, datos);
  }
}
