import { Compatibilidad } from '../../domain/entities/compatibilidad.entity';

export function toCompatibilidadResponse(c: Compatibilidad) {
  return { marca: c.marca, modelo: c.modelo, anioDesde: c.anioDesde, anioHasta: c.anioHasta };
}
