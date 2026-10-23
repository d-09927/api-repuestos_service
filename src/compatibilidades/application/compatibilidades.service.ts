import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { ValidationDomainError } from '../../common/domain-error';
import { textoObligatorio } from '../../common/validaciones';
import { Compatibilidad } from '../domain/entities/compatibilidad.entity';
import {
  CompatibilidadRepositoryPort,
  VehiculoBuscado,
} from '../domain/ports/compatibilidad.repository.port';
import { CompatibilidadCommand } from './dto/compatibilidad.command';

/** Casos de uso de compatibilidades (qué vehículos aceptan cada repuesto). */
@Injectable()
export class CompatibilidadesService {
  constructor(private readonly compatibilidades: CompatibilidadRepositoryPort) {}

  async reemplazar(repuestoId: string, lista: CompatibilidadCommand[]): Promise<Compatibilidad[]> {
    const nuevas = lista.map((c) => this.armar(repuestoId, c));
    await this.compatibilidades.reemplazarDeRepuesto(repuestoId, nuevas);
    return nuevas;
  }

  listarPorRepuesto(repuestoId: string): Promise<Compatibilidad[]> {
    return this.compatibilidades.listarPorRepuestos([repuestoId]);
  }

  listarPorRepuestos(repuestoIds: string[]): Promise<Compatibilidad[]> {
    return this.compatibilidades.listarPorRepuestos(repuestoIds);
  }

  repuestoIdsPorVehiculo(vehiculo: VehiculoBuscado): Promise<string[]> {
    return this.compatibilidades.repuestoIdsPorVehiculo(vehiculo);
  }

  private armar(repuestoId: string, c: CompatibilidadCommand): Compatibilidad {
    const anioDesde = Number(c.anioDesde);
    const anioHasta = Number(c.anioHasta);
    if (!Number.isInteger(anioDesde) || !Number.isInteger(anioHasta)) {
      throw new ValidationDomainError('Los años de compatibilidad deben ser enteros');
    }
    if (anioDesde > anioHasta) {
      throw new ValidationDomainError('anioDesde no puede ser mayor que anioHasta');
    }
    return new Compatibilidad({
      id: randomUUID(),
      repuestoId,
      marca: textoObligatorio(c.marca, 'La marca del vehículo', 100),
      modelo: textoObligatorio(c.modelo, 'El modelo del vehículo', 100),
      anioDesde,
      anioHasta,
    });
  }
}
