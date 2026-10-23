/** Entidad de dominio: un vehículo (marca, modelo y años) con el que sirve un repuesto. */
export class Compatibilidad {
  id: string;
  repuestoId: string;
  marca: string;
  modelo: string;
  anioDesde: number;
  anioHasta: number;

  constructor(datos: Compatibilidad) {
    Object.assign(this, datos);
  }
}
