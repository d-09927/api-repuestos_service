import { Repuesto } from '../../domain/entities/repuesto.entity';
import { CompatibilidadInfo } from '../../domain/ports/compatibilidad.service.port';

/** Un repuesto junto con los vehículos con los que es compatible. */
export interface RepuestoDetalle {
  repuesto: Repuesto;
  compatibilidad: CompatibilidadInfo[];
}
