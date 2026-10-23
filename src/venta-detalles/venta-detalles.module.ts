import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VentaDetallesService } from './application/venta-detalles.service';
import { VentaDetalleRepositoryPort } from './domain/ports/venta-detalle.repository.port';
import { VentaDetalleTypeOrmRepository } from './infrastructure/adapters/venta-detalle.typeorm.repository';
import { VentaDetalleOrmEntity } from './infrastructure/entities/venta-detalle.orm-entity';
import { VentaDetallesController } from './infrastructure/http/venta-detalles.controller';

@Module({
  imports: [TypeOrmModule.forFeature([VentaDetalleOrmEntity])],
  controllers: [VentaDetallesController],
  providers: [
    VentaDetallesService,
    { provide: VentaDetalleRepositoryPort, useClass: VentaDetalleTypeOrmRepository },
  ],
  exports: [VentaDetallesService],
})
export class VentaDetallesModule {}
