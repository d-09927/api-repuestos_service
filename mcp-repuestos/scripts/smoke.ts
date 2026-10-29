/**
 * Prueba de punta a punta del servidor MCP con un cliente MCP real.
 * Requiere la API levantada. Uso:  REPUESTOS_API_URL=http://localhost:3000/api npm run smoke
 * Crea datos de prueba con SKU únicos (no borra nada).
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { spawn } from 'node:child_process';

const API = process.env.REPUESTOS_API_URL ?? 'http://localhost:3000/api';
let fallos = 0;

function verificar(nombre: string, condicion: boolean, detalle?: unknown) {
  console.log(`${condicion ? '  ✓' : '  ✗'} ${nombre}${condicion ? '' : `  → ${JSON.stringify(detalle)}`}`);
  if (!condicion) fallos++;
}

async function setup<T>(ruta: string, cuerpo: unknown): Promise<T> {
  const r = await fetch(API + ruta, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(cuerpo) });
  if (!r.ok) throw new Error(`setup ${ruta} → ${r.status} ${await r.text()}`);
  return (await r.json()) as T;
}

async function conectarStdio(escritura: boolean) {
  const cliente = new Client({ name: 'smoke', version: '1' });
  await cliente.connect(
    new StdioClientTransport({
      command: 'npx',
      args: ['tsx', 'src/index.ts'],
      env: { ...(process.env as Record<string, string>), REPUESTOS_API_URL: API, MCP_PERMITIR_ESCRITURA: String(escritura) },
    }),
  );
  return cliente;
}

/** Llama una herramienta y devuelve { error, datos } con el JSON ya parseado. */
async function llamar(cliente: Client, nombre: string, args: Record<string, unknown> = {}) {
  const r = (await cliente.callTool({ name: nombre, arguments: args })) as { isError?: boolean; content: { type: string; text: string }[] };
  const texto = r.content[0]?.text ?? '';
  let datos: any = texto;
  try {
    datos = JSON.parse(texto);
  } catch {
    /* mensaje de error en texto plano */
  }
  return { error: !!r.isError, datos, texto };
}

const hoy = new Date(Date.now() - 5 * 3600_000).toISOString().slice(0, 10); // hora de Colombia

async function main() {
  const sufijo = Date.now();
  console.log('\n[1] Solo lectura (escritura apagada)');
  const lectura = await conectarStdio(false);
  const nombresLectura = (await lectura.listTools()).tools.map((t) => t.name);
  verificar('lista 13 herramientas de lectura', nombresLectura.length === 13, nombresLectura);
  verificar('NO expone registrar_venta', !nombresLectura.includes('registrar_venta'));
  await lectura.close();

  console.log('\n[2] Con escritura habilitada');
  const c = await conectarStdio(true);
  const tools = (await c.listTools()).tools;
  verificar('lista 17 herramientas', tools.length === 17, tools.map((t) => t.name));
  verificar('todas tienen descripción', tools.every((t) => (t.description ?? '').length > 20));

  // Datos de prueba (por API directa)
  const rep = await setup<{ id: string }>('/repuestos', {
    sku: `MCP-${sufijo}`, nombre: 'Filtro de aceite MCP', marca: 'Bosch', categoria: 'Filtros', precio: 15000,
    compatibilidad: [{ marca: 'Chevrolet', modelo: 'Spark', anioDesde: 2015, anioHasta: 2022 }],
  });
  const prov = await setup<{ id: string }>('/proveedores', { nit: `${sufijo}`, nombre: 'Proveedor MCP' });
  const cli = await setup<{ id: string }>('/clientes', { tipoDocumento: 'CC', documento: `${sufijo}`, nombre: 'Cliente MCP' });

  console.log('\n[3] Búsquedas');
  let r = await llamar(c, 'buscar_repuestos', { texto: `MCP-${sufijo}` });
  verificar('buscar_repuestos encuentra el SKU', r.datos.items?.length === 1 && r.datos.items[0].id === rep.id, r.datos);
  r = await llamar(c, 'buscar_repuestos_por_vehiculo', { vehiculoMarca: 'Chevrolet', vehiculoModelo: 'Spark', vehiculoAnio: 2018, texto: `MCP-${sufijo}` });
  verificar('buscar_repuestos_por_vehiculo (Spark 2018)', r.datos.items?.length === 1, r.datos);
  r = await llamar(c, 'obtener_repuesto', { id: rep.id });
  verificar('obtener_repuesto devuelve compatibilidad', r.datos.compatibilidad?.length === 1, r.datos);
  r = await llamar(c, 'buscar_proveedores', { texto: `${sufijo}` });
  verificar('buscar_proveedores', r.datos.items?.length === 1, r.datos);
  r = await llamar(c, 'buscar_clientes', { texto: `${sufijo}` });
  verificar('buscar_clientes', r.datos.items?.length === 1, r.datos);

  console.log('\n[4] Compra con confirmación');
  const lineaCompra = [{ repuestoId: rep.id, cantidad: 10, costoUnitario: 6000 }];
  r = await llamar(c, 'registrar_compra', { proveedorId: prov.id, lineas: lineaCompra, confirmado: false });
  verificar('sin confirmar: solo muestra resumen (total 60000)', r.datos.requiereConfirmacion === true && r.datos.resumen.total === 60000, r.datos);
  r = await llamar(c, 'consultar_stock', { repuestoId: rep.id });
  verificar('sin confirmar: el stock NO cambió', r.datos.totalFisico === 0, r.datos);
  r = await llamar(c, 'registrar_compra', { proveedorId: prov.id, lineas: lineaCompra, numeroFacturaProveedor: 'FV-MCP', confirmado: true });
  verificar('confirmada: se registra (C-xxxxxx)', r.datos.ejecutado === true && /^C-\d{6}$/.test(r.datos.compra.numero), r.datos);
  const compraId = r.datos.compra?.id;
  r = await llamar(c, 'consultar_stock', { repuestoId: rep.id });
  verificar('stock = 10', r.datos.totalFisico === 10 && r.datos.totalDisponible === 10, r.datos);

  console.log('\n[5] Disponibilidad');
  r = await llamar(c, 'disponibilidad_repuestos', { vehiculoMarca: 'Chevrolet', vehiculoModelo: 'Spark', vehiculoAnio: 2018, texto: `MCP-${sufijo}` });
  verificar('precio 15000 y disponible 10', r.datos.items?.[0]?.disponible === 10 && r.datos.items[0].precio === 15000, r.datos);

  console.log('\n[6] Venta con confirmación');
  const lineaVenta = [{ repuestoId: rep.id, cantidad: 3 }];
  r = await llamar(c, 'registrar_venta', { clienteId: cli.id, lineas: lineaVenta, confirmado: false });
  verificar('resumen: total 45000, alcanza', r.datos.resumen?.total === 45000 && r.datos.resumen.lineas[0].alcanza === true, r.datos);
  r = await llamar(c, 'registrar_venta', { clienteId: cli.id, lineas: lineaVenta, confirmado: true });
  verificar('venta registrada (V-xxxxxx)', r.datos.ejecutado === true && /^V-\d{6}$/.test(r.datos.venta.numero), r.datos);
  const ventaId = r.datos.venta?.id;
  r = await llamar(c, 'consultar_stock', { repuestoId: rep.id });
  verificar('stock = 7', r.datos.totalFisico === 7, r.datos);

  console.log('\n[7] Errores de negocio llegan como isError legible');
  r = await llamar(c, 'registrar_venta', { lineas: [{ repuestoId: rep.id, cantidad: 999 }], confirmado: true });
  verificar('vender 999 → isError con "Conflicto"', r.error && /Conflicto/.test(r.texto), r.texto);
  r = await llamar(c, 'registrar_venta', { lineas: [{ repuestoId: rep.id, cantidad: 999 }], confirmado: false });
  verificar('el resumen avisa que no alcanza', r.datos.resumen?.lineas[0].alcanza === false && !!r.datos.advertencia, r.datos);
  r = await llamar(c, 'obtener_repuesto', { id: '00000000-0000-4000-8000-000000000000' });
  verificar('id inexistente → isError "No existe"', r.error && /No existe/.test(r.texto), r.texto);
  const invalido = await c.callTool({ name: 'consultar_stock', arguments: { repuestoId: 'no-es-uuid' } }).then(
    (x) => !!(x as { isError?: boolean }).isError,
    () => true,
  );
  verificar('argumento inválido (uuid) es rechazado', invalido);

  console.log('\n[8] Reservas');
  r = await llamar(c, 'reservar_repuesto', { repuestoId: rep.id, cantidad: 2, motivo: 'OT-1', confirmado: true });
  verificar('reservar 2', r.datos.ejecutado === true, r.datos);
  r = await llamar(c, 'consultar_stock', { repuestoId: rep.id });
  verificar('físico 7, disponible 5', r.datos.totalFisico === 7 && r.datos.totalDisponible === 5, r.datos);
  r = await llamar(c, 'liberar_reserva', { repuestoId: rep.id, cantidad: 2, confirmado: true });
  verificar('liberar 2', r.datos.ejecutado === true, r.datos);

  console.log('\n[9] Consultas de documentos y movimientos');
  r = await llamar(c, 'consultar_ventas', { clienteId: cli.id, desde: hoy, hasta: hoy });
  verificar('consultar_ventas por cliente y fecha', r.datos.items?.length === 1, r.datos);
  r = await llamar(c, 'obtener_venta', { id: ventaId });
  verificar('obtener_venta con 1 línea', r.datos.detalles?.length === 1, r.datos);
  r = await llamar(c, 'consultar_compras', { proveedorId: prov.id, desde: hoy, hasta: hoy });
  verificar('consultar_compras por proveedor y fecha', r.datos.items?.length === 1, r.datos);
  r = await llamar(c, 'obtener_compra', { id: compraId });
  verificar('obtener_compra con 1 línea', r.datos.detalles?.length === 1, r.datos);
  r = await llamar(c, 'consultar_movimientos', { repuestoId: rep.id });
  verificar('movimientos: ≥ 4 (entrada, salida, reserva, liberación)', r.datos.items?.length >= 4, r.datos.items?.length);
  r = await llamar(c, 'stock_bajo');
  verificar('stock_bajo responde', !r.error && Array.isArray(r.datos), r.datos);
  await c.close();

  console.log('\n[10] Transporte HTTP con token');
  const puerto = 3199;
  const hijo = spawn('npx', ['tsx', 'src/index.ts'], {
    env: { ...process.env, REPUESTOS_API_URL: API, MCP_TRANSPORT: 'http', MCP_PORT: String(puerto), MCP_TOKEN: 'secreto', MCP_PERMITIR_ESCRITURA: 'false' },
    stdio: 'ignore',
  });
  try {
    for (let i = 0; i < 40; i++) {
      if (await fetch(`http://localhost:${puerto}/health`).then((x) => x.ok, () => false)) break;
      await new Promise((x) => setTimeout(x, 250));
    }
    const sinToken = await fetch(`http://localhost:${puerto}/mcp`, { method: 'POST', body: '{}' });
    verificar('sin token → 401', sinToken.status === 401, sinToken.status);
    const h = new Client({ name: 'smoke-http', version: '1' });
    await h.connect(new StreamableHTTPClientTransport(new URL(`http://localhost:${puerto}/mcp`), { requestInit: { headers: { authorization: 'Bearer secreto' } } }));
    verificar('con token: lista 13 herramientas', (await h.listTools()).tools.length === 13);
    r = await llamar(h, 'disponibilidad_repuestos', { texto: `MCP-${sufijo}` });
    verificar('con token: ejecuta una herramienta', r.datos.items?.[0]?.disponible === 7, r.datos);
    await h.close();
  } finally {
    hijo.kill();
  }

  console.log(fallos === 0 ? '\nTODO OK' : `\n${fallos} verificación(es) fallaron`);
  process.exit(fallos === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
