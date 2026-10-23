/** Entidad de dominio: solo describe los datos del proveedor. Las reglas están en ProveedoresService. */
export class Proveedor {
  id: string;
  nit: string;
  nombre: string;
  contacto: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  activo: boolean;
  creadoEn: Date;
  actualizadoEn: Date;

  constructor(datos: Proveedor) {
    Object.assign(this, datos);
  }
}
