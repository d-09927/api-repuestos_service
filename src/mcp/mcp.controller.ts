import { createMcpHandler } from "@modelcontextprotocol/server";
import { All, Controller, Logger, Req, Res } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AgenteService } from "../agente/application/agente.service";
import { PedidosService } from "../pedidos/application/pedidos.service";
import { ClientesService } from "../clientes/application/clientes.service";
import { ComprasService } from "../compras/application/compras.service";
import { MovimientosService } from "../movimientos/application/movimientos.service";
import { ProveedoresService } from "../proveedores/application/proveedores.service";
import { RepuestosService } from "../repuestos/application/repuestos.service";
import { StockService } from "../stock/application/stock.service";
import { VentasService } from "../ventas/application/ventas.service";
import { crearServidorAutomax, crearServidorMcp } from "./herramienta";
import { toNodeHandler } from "@modelcontextprotocol/node"; 
import { timingSafeEqual } from "crypto";
import { Request, Response } from "express";

 
function tokenDe(req: { headers: Record<string, unknown> }): string | undefined {
  const [tipo, token] = String(req.headers.authorization ?? '').split(' ');
  return tipo === 'Bearer' ? token : undefined;
}

/** El contrato con AutoMax pide un token de 16 caracteres o más. */
const LARGO_MINIMO_AUTOMAX = 16;

function iguales(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
 

@Controller('mcp')
export class McpController{

    private readonly logger = new Logger('MCP');
    private readonly atender;
    private readonly atenderAutomax;

    constructor(
        repuestos: RepuestosService,
        stock:StockService,
        ventas:VentasService,
        clientes:ClientesService,
        compras: ComprasService,
        movimientos:MovimientosService,
        proveedores: ProveedoresService,
        agente: AgenteService,
        pedidos: PedidosService,

        private readonly config: ConfigService,
    ){
        // servidor por peticion
        const manejador = createMcpHandler(()=>
            crearServidorMcp(
                {
                    repuestos,stock,ventas,clientes,compras,movimientos,proveedores,agente,pedidos
                },
                {
                    permitirEscritura: this.config.get('MCP_PERMITIR_ESCRITURA') === 'true',
                    tienda: this.config.get<string>('TIENDA_NOMBRE', 'Tienda de repuestos'),
                    ivaPorcentaje: Number(this.config.get('IVA_PORCENTAJE', 19)),
                },
            ),
        );
        this.atender = toNodeHandler(manejador)
        this.atenderAutomax = toNodeHandler(createMcpHandler(()=>
            crearServidorAutomax({
                repuestos,stock,ventas,clientes,compras,movimientos,proveedores,agente,pedidos
            }),
        ));
        const automax = this.config.get<string>('MCP_TOKEN_AUTOMAX');
        if (automax && automax.length < LARGO_MINIMO_AUTOMAX) {
            this.logger.warn(`MCP_TOKEN_AUTOMAX se ignora: debe tener ${LARGO_MINIMO_AUTOMAX} caracteres o más`);
        }
    }

    @All()
    async manejar(@Req() req:Request, @Res() res:Response) {
        const esperado = this.config.get<string>('MCP_TOKEN');
        const automax = this.config.get<string>('MCP_TOKEN_AUTOMAX');
        const tokenAutomax = automax && automax.length >= LARGO_MINIMO_AUTOMAX ? automax : undefined;
        if(!esperado && !tokenAutomax) {
            res.status(503).json({error: ' El MCP esta desactivado: defina MCP_TOKEN en el .env'})
            return;
        }

        const recibido  = tokenDe(req);
        if(recibido && tokenAutomax && iguales(recibido, tokenAutomax)) {
            await this.atenderAutomax(req as never, res, req.body);
            return;
        }
        if(!recibido || !esperado || !iguales(recibido, esperado)) {
            res.setHeader('www-Authenticate', 'Bearer');
            res.status(401).json({ error: 'Falta el token de acceso o no es valido'});
            return
        }
        await this.atender(req as never, res, req.body)
    }
}