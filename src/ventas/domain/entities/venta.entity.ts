import { EstadoVenta } from '../enums/estado-venta.enum';

/** Entidad de dominio: cabecera de una venta. Sus líneas están en venta-detalles. */
export class Venta {
  id: string;
  numero: string;
  /** Opcional: una venta de mostrador puede no tener cliente registrado. */
  clienteId: string | null;
  /** Vehículo al que va el repuesto. Sin VIN, la venta no cuenta para la garantía de AutoMax. */
  vin: string | null;
  /** Orden de taller, si la venta salió de un pedido. */
  codigoOrden: string | null;
  bodega: string;
  observaciones: string | null;
  total: number;
  estado: EstadoVenta;
  /** Referencia del pago (PSE, transferencia). null en las de mostrador y mientras no se pague. */
  referenciaPago: string | null;
  pagadaEn: Date | null;
  fecha: Date;
  creadoEn: Date;

  constructor(datos: Venta) {
    Object.assign(this, datos);
  }
}
