import { Proveedor } from '../../domain/entities/proveedor.entity';

export function toProveedorResponse(p: Proveedor) {
  return {
    id: p.id,
    nit: p.nit,
    nombre: p.nombre,
    contacto: p.contacto,
    telefono: p.telefono,
    email: p.email,
    direccion: p.direccion,
    activo: p.activo,
    creadoEn: p.creadoEn,
    actualizadoEn: p.actualizadoEn,
  };
}
