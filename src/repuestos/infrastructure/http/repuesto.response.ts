import { RepuestoDetalle } from '../../application/dto/repuesto-detalle.result';

export function toRepuestoResponse({ repuesto: r, compatibilidad }: RepuestoDetalle) {
  return {
    id: r.id,
    sku: r.sku,
    codigoUniversal: r.codigoUniversal,
    nombre: r.nombre,
    descripcion: r.descripcion,
    marca: r.marca,
    categoria: r.categoria,
    precio: r.precio,
    activo: r.activo,
    compatibilidad: compatibilidad.map((c) => ({
      marca: c.marca,
      modelo: c.modelo,
      anioDesde: c.anioDesde,
      anioHasta: c.anioHasta,
    })),
    creadoEn: r.creadoEn,
    actualizadoEn: r.actualizadoEn,
  };
}
