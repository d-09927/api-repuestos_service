import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientesModule } from './clientes/clientes.module';
import { UnidadDeTrabajoModule } from './common/unidad-de-trabajo/unidad-de-trabajo.module';
import { CompatibilidadesModule } from './compatibilidades/compatibilidades.module';
import { CompraDetallesModule } from './compra-detalles/compra-detalles.module';
import { ComprasModule } from './compras/compras.module';
import { McpModule } from './mcp/mcp.module';
import { MovimientosModule } from './movimientos/movimientos.module';
import { ProveedoresModule } from './proveedores/proveedores.module';
import { RepuestosModule } from './repuestos/repuestos.module';
import { StockModule } from './stock/stock.module';
import { VentaDetallesModule } from './venta-detalles/venta-detalles.module';
import { VentasModule } from './ventas/ventas.module';
import { AgenteModule } from './agente/agente.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        host: config.get<string>('DB_HOST', 'localhost'),
        port: Number(config.get('DB_PORT', 5432)),
        username: config.get<string>('DB_USER', 'repuestos'),
        password: config.get<string>('DB_PASSWORD', 'repuestos_dev'),
        database: config.get<string>('DB_NAME', 'repuestos'),
        autoLoadEntities: true,
        synchronize: config.get('DB_SYNCHRONIZE', 'true') === 'true',
      }),
    }),
    UnidadDeTrabajoModule,
    // Un módulo por tabla.
    RepuestosModule,
    CompatibilidadesModule,
    StockModule,
    MovimientosModule,
    ProveedoresModule,
    ClientesModule,
    ComprasModule,
    CompraDetallesModule,
    VentasModule,
    VentaDetallesModule,
    // Puerta de entrada para agentes (llama a los services de arriba).
    McpModule,
    AgenteModule
  ],
})
export class AppModule {}
