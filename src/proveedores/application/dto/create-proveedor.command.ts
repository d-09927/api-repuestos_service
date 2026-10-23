export interface CreateProveedorCommand {
  nit: string;
  nombre: string;
  contacto?: string;
  telefono?: string;
  email?: string;
  direccion?: string;
}
