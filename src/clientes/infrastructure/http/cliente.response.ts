import { Cliente } from '../../domain/entities/cliente.entity';

export function toClienteResponse(c: Cliente) {
  return {
    id: c.id,
    tipoDocumento: c.tipoDocumento,
    documento: c.documento,
    nombre: c.nombre,
    telefono: c.telefono,
    email: c.email,
    direccion: c.direccion,
    activo: c.activo,
    creadoEn: c.creadoEn,
    actualizadoEn: c.actualizadoEn,
  };
}
