import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompatibilidadesService } from './application/compatibilidades.service';
import { CompatibilidadRepositoryPort } from './domain/ports/compatibilidad.repository.port';
import { CompatibilidadTypeOrmRepository } from './infrastructure/adapters/compatibilidad.typeorm.repository';
import { CompatibilidadOrmEntity } from './infrastructure/entities/compatibilidad.orm-entity';
import { CompatibilidadesController } from './infrastructure/http/compatibilidades.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CompatibilidadOrmEntity])],
  controllers: [CompatibilidadesController],
  providers: [
    CompatibilidadesService,
    { provide: CompatibilidadRepositoryPort, useClass: CompatibilidadTypeOrmRepository },
  ],
  exports: [CompatibilidadesService],
})
export class CompatibilidadesModule {}
