import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { config } from './config.js';
import { registrarDocumentos } from './tools/documentos.tools.js';
import { registrarEscritura } from './tools/escritura.tools.js';
import { registrarPersonas } from './tools/personas.tools.js';
import { registrarRepuestos } from './tools/repuestos.tools.js';
import { registrarStock } from './tools/stock.tools.js';

/** Construye el servidor MCP con todas sus herramientas (un módulo de herramientas por dominio). */
export function crearServidor(): McpServer {
  const server = new McpServer(
    { name: 'mcp-repuestos', version: '0.1.0' },
    {
      instructions:
        'Herramientas del almacén de repuestos de la concesionaria. Los precios están en pesos colombianos. ' +
        'Consulta siempre con las herramientas; no inventes existencias ni precios. ' +
        'Las herramientas que modifican datos piden confirmación explícita del usuario.',
    },
  );

  registrarRepuestos(server);
  registrarStock(server);
  registrarPersonas(server);
  registrarDocumentos(server);
  if (config.permitirEscritura) registrarEscritura(server);

  return server;
}
