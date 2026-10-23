import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompraDetallesService } from './application/compra-detalles.service';
import { CompraDetalleRepositoryPort } from './domain/ports/compra-detalle.repository.port';
import { CompraDetalleTypeOrmRepository } from './infrastructure/adapters/compra-detalle.typeorm.repository';
import { CompraDetalleOrmEntity } from './infrastructure/entities/compra-detalle.orm-entity';
import { CompraDetallesController } from './infrastructure/http/compra-detalles.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CompraDetalleOrmEntity])],
  controllers: [CompraDetallesController],
  providers: [
    CompraDetallesService,
    { provide: CompraDetalleRepositoryPort, useClass: CompraDetalleTypeOrmRepository },
  ],
  exports: [CompraDetallesService],
})
export class CompraDetallesModule {}
