import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompatibilidadesModule } from '../compatibilidades/compatibilidades.module';
import { RepuestosService } from './application/repuestos.service';
import { CompatibilidadServicePort } from './domain/ports/compatibilidad.service.port';
import { RepuestoRepositoryPort } from './domain/ports/repuesto.repository.port';
import { CompatibilidadLocalAdapter } from './infrastructure/adapters/compatibilidad.local.adapter';
import { RepuestoTypeOrmRepository } from './infrastructure/adapters/repuesto.typeorm.repository';
import { RepuestoOrmEntity } from './infrastructure/entities/repuesto.orm-entity';
import { RepuestosController } from './infrastructure/http/repuestos.controller';

@Module({
  imports: [TypeOrmModule.forFeature([RepuestoOrmEntity]), CompatibilidadesModule],
  controllers: [RepuestosController],
  providers: [
    RepuestosService,
    { provide: RepuestoRepositoryPort, useClass: RepuestoTypeOrmRepository },
    { provide: CompatibilidadServicePort, useClass: CompatibilidadLocalAdapter },
  ],
  // Stock, compras y ventas usan el service (a través de su propio puerto), nunca la tabla.
  exports: [RepuestosService],
})
export class RepuestosModule {}
