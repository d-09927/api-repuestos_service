/** Entidad de dominio: solo describe los datos del repuesto. Las reglas están en RepuestosService. */
export class Repuesto {
  id: string;
  sku: string;
  /** Código universal (igual en todas las tiendas, el que usan taller y facturación). Varias marcas pueden compartirlo. */
  codigoUniversal: string | null;
  nombre: string;
  descripcion: string | null;
  marca: string;
  categoria: string;
  precio: number;
  activo: boolean;
  creadoEn: Date;
  actualizadoEn: Date;

  constructor(datos: Repuesto) {
    Object.assign(this, datos);
  }
}
