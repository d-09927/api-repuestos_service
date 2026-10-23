import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MovimientosModule } from '../movimientos/movimientos.module';
import { RepuestosModule } from '../repuestos/repuestos.module';
import { StockService } from './application/stock.service';
import { MovimientoServicePort } from './domain/ports/movimiento.service.port';
import { RepuestoServicePort } from './domain/ports/repuesto.service.port';
import { StockRepositoryPort } from './domain/ports/stock.repository.port';
import { MovimientoLocalAdapter } from './infrastructure/adapters/movimiento.local.adapter';
import { RepuestoLocalAdapter } from './infrastructure/adapters/repuesto.local.adapter';
import { StockTypeOrmRepository } from './infrastructure/adapters/stock.typeorm.repository';
import { StockOrmEntity } from './infrastructure/entities/stock.orm-entity';
import { StockController } from './infrastructure/http/stock.controller';

@Module({
  imports: [RepuestosModule, MovimientosModule, TypeOrmModule.forFeature([StockOrmEntity])],
  controllers: [StockController],
  providers: [
    StockService,
    { provide: StockRepositoryPort, useClass: StockTypeOrmRepository },
    { provide: RepuestoServicePort, useClass: RepuestoLocalAdapter },
    { provide: MovimientoServicePort, useClass: MovimientoLocalAdapter },
  ],
  // Compras y ventas mueven stock a través de este service (por sus propios puertos).
  exports: [StockService],
})
export class StockModule {}
