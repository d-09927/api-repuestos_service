import { createMcpHandler } from "@modelcontextprotocol/server";
import { All, Controller, Req, Res } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ClientesService } from "../clientes/application/clientes.service";
import { ComprasService } from "../compras/application/compras.service";
import { MovimientosService } from "../movimientos/application/movimientos.service";
import { ProveedoresService } from "../proveedores/application/proveedores.service";
import { RepuestosService } from "../repuestos/application/repuestos.service";
import { StockService } from "../stock/application/stock.service";
import { VentasService } from "../ventas/application/ventas.service";
import { crearServidorMcp } from "./herramienta";
import { toNodeHandler } from "@modelcontextprotocol/node"; 
import { timingSafeEqual } from "crypto";
import { Request, Response } from "express";

 
function tokenDe(req: { headers: Record<string, unknown> }): string | undefined {
  const [tipo, token] = String(req.headers.authorization ?? '').split(' ');
  return tipo === 'Bearer' ? token : undefined;
}

function iguales(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
 

@Controller('mcp')
export class McpController{

    private readonly atender;

    constructor(
        repuestos: RepuestosService,
        stock:StockService,
        ventas:VentasService,
        clientes:ClientesService,
        compras: ComprasService,
        movimientos:MovimientosService,
        proveedores: ProveedoresService,

        private readonly config: ConfigService,
    ){
        // servidor por peticion
        const manejador = createMcpHandler(()=>
            crearServidorMcp(
                {
                    repuestos,stock,ventas,clientes,compras,movimientos,proveedores
                },
                { permitirEscritura: this.config.get('MCP_PERMITIR_ESCRITURA') === 'true'},
            ),
        );
        this.atender = toNodeHandler(manejador)
    }

    @All()
    async manejar(@Req() req:Request, @Res() res:Response) {
        const esperado = this.config.get<string>('MCP_TOKEN');;
        if(!esperado) {
            res.status(503).json({error: ' El MCP esta desactivado: defina MCP_TOKEN en el .env'})
            return;
        }

        const recibido  = tokenDe(req);
        if(!recibido || !iguales(recibido, esperado)) {
            res.setHeader('www-Authenticate', 'Bearer');
            res.status(401).json({ error: 'Falta el token de acceso o no es valido'});
            return
        }
        await this.atender(req as never, res, req.body)
    }
}