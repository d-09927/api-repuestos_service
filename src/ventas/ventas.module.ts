import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientesModule } from '../clientes/clientes.module';
import { RepuestosModule } from '../repuestos/repuestos.module';
import { StockModule } from '../stock/stock.module';
import { VentaDetallesModule } from '../venta-detalles/venta-detalles.module';
import { VentasService } from './application/ventas.service';
import { ClienteServicePort } from './domain/ports/cliente.service.port';
import { RepuestoServicePort } from './domain/ports/repuesto.service.port';
import { StockServicePort } from './domain/ports/stock.service.port';
import { VentaDetalleServicePort } from './domain/ports/venta-detalle.service.port';
import { VentaRepositoryPort } from './domain/ports/venta.repository.port';
import { ClienteLocalAdapter } from './infrastructure/adapters/cliente.local.adapter';
import { RepuestoLocalAdapter } from './infrastructure/adapters/repuesto.local.adapter';
import { StockLocalAdapter } from './infrastructure/adapters/stock.local.adapter';
import { VentaDetalleLocalAdapter } from './infrastructure/adapters/venta-detalle.local.adapter';
import { VentaTypeOrmRepository } from './infrastructure/adapters/venta.typeorm.repository';
import { VentaOrmEntity } from './infrastructure/entities/venta.orm-entity';
import { VentasController } from './infrastructure/http/ventas.controller';

@Module({
  imports: [
    VentaDetallesModule,
    ClientesModule,
    RepuestosModule,
    StockModule,
    TypeOrmModule.forFeature([VentaOrmEntity]),
  ],
  controllers: [VentasController],
  exports: [VentasService],
  providers: [
    VentasService,
    { provide: VentaRepositoryPort, useClass: VentaTypeOrmRepository },
    { provide: VentaDetalleServicePort, useClass: VentaDetalleLocalAdapter },
    { provide: ClienteServicePort, useClass: ClienteLocalAdapter },
    { provide: RepuestoServicePort, useClass: RepuestoLocalAdapter },
    { provide: StockServicePort, useClass: StockLocalAdapter },
  ],
})
export class VentasModule {}
