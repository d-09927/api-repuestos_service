import { TipoDocumento } from '../enums/tipo-documento.enum';

/** Entidad de dominio: solo describe los datos del cliente. Las reglas están en ClientesService. */
export class Cliente {
  id: string;
  tipoDocumento: TipoDocumento;
  documento: string;
  nombre: string;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  activo: boolean;
  creadoEn: Date;
  actualizadoEn: Date;

  constructor(datos: Cliente) {
    Object.assign(this, datos);
  }
}
