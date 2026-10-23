import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MovimientosService } from './application/movimientos.service';
import { MovimientoRepositoryPort } from './domain/ports/movimiento.repository.port';
import { MovimientoTypeOrmRepository } from './infrastructure/adapters/movimiento.typeorm.repository';
import { MovimientoOrmEntity } from './infrastructure/entities/movimiento.orm-entity';
import { MovimientosController } from './infrastructure/http/movimientos.controller';

@Module({
  imports: [TypeOrmModule.forFeature([MovimientoOrmEntity])],
  controllers: [MovimientosController],
  providers: [
    MovimientosService,
    { provide: MovimientoRepositoryPort, useClass: MovimientoTypeOrmRepository },
  ],
  exports: [MovimientosService],
})
export class MovimientosModule {}
