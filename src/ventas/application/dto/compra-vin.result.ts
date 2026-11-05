/** Un repuesto vendido para un vehículo. Sin datos del comprador: con el VIN basta. */
export interface CompraDeVin {
  fecha: Date;
  codigoRepuesto: string;
  /** frenos | suspension | motor | electrico | transmision */
  categoria: string;
  descripcion: string;
  cantidad: number;
  /** null si no fue para una orden de taller (venta de mostrador). */
  codigoOrden: string | null;
}
