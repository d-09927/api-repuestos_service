#!/usr/bin/env node
import { createServer } from 'node:http';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { config } from './config.js';
import { crearServidor } from './server.js';

// IMPORTANTE: con stdio, stdout es el canal del protocolo. Los logs van siempre a stderr.
const log = (...mensaje: unknown[]) => console.error('[mcp-repuestos]', ...mensaje);

async function iniciarStdio() {
  await crearServidor().connect(new StdioServerTransport());
  log(`listo (stdio) → API ${config.apiUrl} | escritura: ${config.permitirEscritura ? 'SÍ' : 'no'}`);
}

/** HTTP sin estado: cada petición usa su propio servidor y transporte, así escala y no comparte sesiones. */
function iniciarHttp() {
  const http = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');

    if (url.pathname === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' }).end('{"ok":true}');
      return;
    }
    if (url.pathname !== '/mcp') {
      res.writeHead(404).end();
      return;
    }
    if (config.token && req.headers.authorization !== `Bearer ${config.token}`) {
      res.writeHead(401, { 'content-type': 'application/json' }).end('{"error":"No autorizado"}');
      return;
    }
    if (req.method !== 'POST') {
      res.writeHead(405, { allow: 'POST' }).end();
      return;
    }

    try {
      const partes: Buffer[] = [];
      for await (const parte of req) partes.push(parte as Buffer);
      const cuerpo = JSON.parse(Buffer.concat(partes).toString('utf8'));

      const server = crearServidor();
      const transporte = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
      res.on('close', () => {
        void transporte.close();
        void server.close();
      });
      await server.connect(transporte);
      await transporte.handleRequest(req, res, cuerpo);
    } catch (error) {
      log('error atendiendo petición:', (error as Error).message);
      if (!res.headersSent) res.writeHead(400, { 'content-type': 'application/json' }).end('{"error":"Petición inválida"}');
    }
  });

  http.listen(config.puerto, () =>
    log(`listo (http) en http://localhost:${config.puerto}/mcp → API ${config.apiUrl} | escritura: ${config.permitirEscritura ? 'SÍ' : 'no'}${config.token ? ' | con token' : ''}`),
  );
}

if (config.transporte === 'http') iniciarHttp();
else await iniciarStdio();
