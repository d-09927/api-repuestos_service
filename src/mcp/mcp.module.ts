import { Module } from "@nestjs/common";
import { AgenteModule } from "../agente/agente.module";
import { ClientesModule } from "../clientes/clientes.module";
import { ComprasModule } from "../compras/compras.module";
import { MovimientosModule } from "../movimientos/movimientos.module";
import { ProveedoresModule } from "../proveedores/proveedores.module";
import { RepuestosModule } from "../repuestos/repuestos.module";
import { StockModule } from "../stock/stock.module";
import { VentasModule } from "../ventas/ventas.module";
import { PedidosModule } from "../pedidos/pedidos.module";
import { BitacoraModule } from "../bitacora/bitacora.module";
import { McpController } from "./mcp.controller";

// Importa los módulos (no los services) cuyos services usan las herramientas.
@Module({
    imports:[
        RepuestosModule,
        StockModule,
        ProveedoresModule,
        MovimientosModule,
        ClientesModule,
        ComprasModule,
        VentasModule,
        AgenteModule,
        PedidosModule,
        BitacoraModule,
    ],
    controllers:[McpController]
})

export class McpModule {};
