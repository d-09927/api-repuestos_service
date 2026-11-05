import { McpServer } from "@modelcontextprotocol/server";
import { AgenteService } from "../agente/application/agente.service";
import { PedidosService } from "../pedidos/application/pedidos.service";
import { RepuestosService } from "../repuestos/application/repuestos.service";
import { StockService } from "../stock/application/stock.service";
import { MovimientosService } from "../movimientos/application/movimientos.service";
import { ProveedoresService } from "../proveedores/application/proveedores.service";
import { ClientesService } from "../clientes/application/clientes.service";
import { ComprasService } from "../compras/application/compras.service";
import { VentasService } from "../ventas/application/ventas.service";
import { registrarAgente } from "./herramientas/agente.herramientas";
import { registrarCotizacion } from "./herramientas/cotizacion.herramientas";
import { registrarDocumentos } from "./herramientas/documentos.herramientas";
import { registrarEscritura } from "./herramientas/escritura.herramientas";
import { registrarGarantias } from "./herramientas/garantias.herramientas";
import { registrarPedidos } from "./herramientas/pedidos.herramientas";
import { registrarPersonas } from "./herramientas/personas.herramientas";
import { registrarRepuestos } from "./herramientas/repuestos.herramientas";
import { registrarStock } from "./herramientas/stock.herramientas";



export interface Servicios {
  repuestos: RepuestosService;
  stock: StockService;
  movimientos: MovimientosService;
  proveedores: ProveedoresService;
  clientes: ClientesService;
  compras: ComprasService;
  ventas: VentasService;
  agente: AgenteService;
  pedidos: PedidosService;
}

export interface OpcionesMcp {
  permitirEscritura: boolean;
  /** Nombre con el que nos identificamos ante facturación (TIENDA_NOMBRE). */
  tienda: string;
  /** IVA incluido en los precios del catálogo (IVA_PORCENTAJE). */
  ivaPorcentaje: number;
}


export function crearServidorMcp (
servicios: Servicios, opciones:OpcionesMcp
): McpServer {

    const servidor = new McpServer (
        { name: "repuestos", version: '1.0.0'},
        {
            instructions: 
            'Herramientas del almacén de repuestos de la concesionaria. Los precios están en pesos colombianos. ' +
        'Consulte siempre con las herramientas; no invente existencias ni precios. ' +
        'Antes de registrar una venta, una compra o una reserva, muestre el resumen al usuario y pida su confirmación.',
        },
    );

    registrarRepuestos(servidor,servicios);
    registrarStock(servidor, servicios);
    registrarPersonas(servidor, servicios);
    registrarDocumentos(servidor, servicios);
    registrarCotizacion(servidor, servicios, opciones);
    // consultar_orden siempre; apartar, entregar, cancelar y pagar solo con escritura habilitada.
    registrarPedidos(servidor, servicios, opciones);
    // Puerta de entrada de los agentes de otros sectores.
    registrarAgente(servidor, servicios);

    // Las de escritura ni siquiera aparecen si el servidor está en solo lectura.
    if (opciones.permitirEscritura) registrarEscritura(servidor, servicios);

    return servidor
}

/** El servidor que ve AutoMax con su token: solo la consulta de la garantía, nada del resto del MCP. */
export function crearServidorAutomax(servicios: Servicios): McpServer {
    const servidor = new McpServer({ name: "repuestos-garantias", version: '1.0.0' });
    registrarGarantias(servidor, servicios);
    return servidor;
}
