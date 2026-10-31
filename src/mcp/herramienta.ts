import { McpServer } from "@modelcontextprotocol/server";
import { RepuestosService } from "../repuestos/application/repuestos.service";
import { StockService } from "../stock/application/stock.service";
import { MovimientosService } from "../movimientos/application/movimientos.service";
import { ProveedoresService } from "../proveedores/application/proveedores.service";
import { ClientesService } from "../clientes/application/clientes.service";
import { ComprasService } from "../compras/application/compras.service";
import { VentasService } from "../ventas/application/ventas.service";
import { registrarCotizacion } from "./herramientas/cotizacion.herramientas";
import { registrarDocumentos } from "./herramientas/documentos.herramientas";
import { registrarEscritura } from "./herramientas/escritura.herramientas";
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

    // Las de escritura ni siquiera aparecen si el servidor está en solo lectura.
    if (opciones.permitirEscritura) registrarEscritura(servidor, servicios);

    return servidor
}