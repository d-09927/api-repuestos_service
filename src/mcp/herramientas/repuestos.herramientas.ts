import { McpServer } from "@modelcontextprotocol/server";
import { Servicios } from "../herramienta";
import { z } from "zod";
import { paginacion, paginar, seguro, SOLO_LECTURA, id } from "./comunes";
import { toRepuestoResponse } from "../../repuestos/infrastructure/http/repuesto.response";

export function registrarRepuestos(servidor:McpServer, {repuestos}: Servicios) {
    servidor.registerTool(
        'buscar_repuestos',
        {
            title: 'Buscar repuestos',
            description:
            'Busca repuestos del catálogo por texto (nombre, SKU o descripción), marca o categoría. ' +
            'Devuelve id, sku, nombre, marca, categoría, precio en pesos colombianos y los vehículos compatibles. ' +
            'No incluye existencias: para saber si hay unidades use consultar_stock o disponibilidad_repuestos.',

            inputSchema: z.object({
                texto: z.string().optional().describe("Parte del nombre, SKU o descripcion; por ejemplo: filtro"),
                marca: z.string().optional().describe("Marca del repuesto: por ejemplo: Bosch"),
                categoria: z.string().optional().describe('Categoria; por ejemplo: filtros'),

                ...paginacion,
            }),
            annotations: SOLO_LECTURA,
        },
        (args)=>
            seguro(async ()=>{
                const pagina = await repuestos.listar({...args,...paginar(args)});
                return {...pagina, items: pagina.items.map(toRepuestoResponse)}
            })
    );

    servidor.registerTool(
        'buscar_repuestos_por_vehiculo',
        {
            title:'Buscar repuestos por vehiculo',
            description: 
            'Busca los repuestos compatibles con un vehículo (marca y modelo, y opcionalmente el año). ' +
            'Úsela cuando el cliente pregunta qué sirve para su carro.',

            inputSchema: z.object({
                vehiculoMarca: z.string().describe('Marca del vehiculo; por ejemplo: Chevrolet'),
                vehiculoModelo: z.string().describe("Modelo del vehiculo; por ejemplo: Spark"),
                vehiculoAnio: z.number().int().min(1900).max(2100).optional().describe('Añoa del  vehiculo'),
                texto: z.string().optional().describe('Filtra ademas por nombre; por ejemplo: filtro de aceite'),

                ...paginacion,
            }),
            annotations: SOLO_LECTURA,
        },
        (args)=>
            seguro(async ()=>{
                const pagina = await repuestos.listar({...args,...paginar(args)});
                return {...pagina, items: pagina.items.map(toRepuestoResponse)}
            })
    );

    servidor.registerTool(
    'obtener_repuesto',
    {
      title: 'Obtener un repuesto',
      description: 'Devuelve el detalle de un repuesto por su id, con su compatibilidad de vehículos.',
      inputSchema: z.object({ id: id('Id del repuesto, según buscar_repuestos') }),
      annotations: SOLO_LECTURA,
    },
    ({ id }) => seguro(async () => toRepuestoResponse(await repuestos.obtenerDetalle(id))),
  );

    
}