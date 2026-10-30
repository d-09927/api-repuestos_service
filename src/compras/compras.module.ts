import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompraDetallesModule } from '../compra-detalles/compra-detalles.module';
import { ProveedoresModule } from '../proveedores/proveedores.module';
import { RepuestosModule } from '../repuestos/repuestos.module';
import { StockModule } from '../stock/stock.module';
import { ComprasService } from './application/compras.service';
import { CompraDetalleServicePort } from './domain/ports/compra-detalle.service.port';
import { CompraRepositoryPort } from './domain/ports/compra.repository.port';
import { ProveedorServicePort } from './domain/ports/proveedor.service.port';
import { RepuestoServicePort } from './domain/ports/repuesto.service.port';
import { StockServicePort } from './domain/ports/stock.service.port';
import { CompraDetalleLocalAdapter } from './infrastructure/adapters/compra-detalle.local.adapter';
import { CompraTypeOrmRepository } from './infrastructure/adapters/compra.typeorm.repository';
import { ProveedorLocalAdapter } from './infrastructure/adapters/proveedor.local.adapter';
import { RepuestoLocalAdapter } from './infrastructure/adapters/repuesto.local.adapter';
import { StockLocalAdapter } from './infrastructure/adapters/stock.local.adapter';
import { CompraOrmEntity } from './infrastructure/entities/compra.orm-entity';
import { ComprasController } from './infrastructure/http/compras.controller';

@Module({
  imports: [
    CompraDetallesModule,
    ProveedoresModule,
    RepuestosModule,
    StockModule,
    TypeOrmModule.forFeature([CompraOrmEntity]),
  ],
  controllers: [ComprasController],
  exports: [ComprasService],
  providers: [
    ComprasService,
    { provide: CompraRepositoryPort, useClass: CompraTypeOrmRepository },
    { provide: CompraDetalleServicePort, useClass: CompraDetalleLocalAdapter },
    { provide: ProveedorServicePort, useClass: ProveedorLocalAdapter },
    { provide: RepuestoServicePort, useClass: RepuestoLocalAdapter },
    { provide: StockServicePort, useClass: StockLocalAdapter },
  ],
})
export class ComprasModule {}
