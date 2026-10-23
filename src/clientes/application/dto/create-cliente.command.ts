import { TipoDocumento } from '../../domain/enums/tipo-documento.enum';

export interface CreateClienteCommand {
  tipoDocumento: TipoDocumento;
  documento: string;
  nombre: string;
  telefono?: string;
  email?: string;
  direccion?: string;
}
