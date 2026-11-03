import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientesModule } from '../clientes/clientes.module';
import { RepuestosModule } from '../repuestos/repuestos.module';
import { StockModule } from '../stock/stock.module';
import { VentasModule } from '../ventas/ventas.module';
import { PedidosService } from './application/pedidos.service';
import { ClienteServicePort } from './domain/ports/cliente.service.port';
import { PedidoRepositoryPort } from './domain/ports/pedido.repository.port';
import { RepuestoServicePort } from './domain/ports/repuesto.service.port';
import { StockServicePort } from './domain/ports/stock.service.port';
import { VentaServicePort } from './domain/ports/venta.service.port';
import { ClienteLocalAdapter } from './infrastructure/adapters/cliente.local.adapter';
import { PedidoTypeOrmRepository } from './infrastructure/adapters/pedido.typeorm.repository';
import { RepuestoLocalAdapter } from './infrastructure/adapters/repuesto.local.adapter';
import { StockLocalAdapter } from './infrastructure/adapters/stock.local.adapter';
import { VentaLocalAdapter } from './infrastructure/adapters/venta.local.adapter';
import { PedidoOrmEntity } from './infrastructure/entities/pedido.orm-entity';
import { PedidosController } from './infrastructure/http/pedidos.controller';

@Module({
  imports: [ClientesModule, RepuestosModule, StockModule, VentasModule, TypeOrmModule.forFeature([PedidoOrmEntity])],
  controllers: [PedidosController],
  providers: [
    PedidosService,
    { provide: PedidoRepositoryPort, useClass: PedidoTypeOrmRepository },
    { provide: RepuestoServicePort, useClass: RepuestoLocalAdapter },
    { provide: StockServicePort, useClass: StockLocalAdapter },
    { provide: VentaServicePort, useClass: VentaLocalAdapter },
    { provide: ClienteServicePort, useClass: ClienteLocalAdapter },
  ],
  // El MCP lo usa en las herramientas de pedidos.
  exports: [PedidosService],
})
export class PedidosModule {}
