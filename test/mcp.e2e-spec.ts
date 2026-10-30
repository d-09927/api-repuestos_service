import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';

// Prueba de punta a punta del MCP con un cliente MCP real contra la API levantada
// (npm run start:dev con MCP_TOKEN y MCP_PERMITIR_ESCRITURA=true). Crea sus propios datos
// por REST, con sufijo único, así que se puede repetir sobre la misma base de datos.
//   npm run test:mcp

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const TOKEN = process.env.MCP_TOKEN ?? 'dev-mcp-token';
const sufijo = Date.now().toString(36);

const LECTURA = [
  'buscar_repuestos',
  'buscar_repuestos_por_vehiculo',
  'obtener_repuesto',
  'consultar_stock',
  'disponibilidad_repuestos',
  'stock_bajo',
  'consultar_movimientos',
  'buscar_proveedores',
  'buscar_clientes',
  'consultar_ventas',
  'obtener_venta',
  'consultar_compras',
  'obtener_compra',
];
const ESCRITURA = ['reservar_repuesto', 'liberar_reserva', 'registrar_venta', 'registrar_compra'];

async function crear<T>(ruta: string, cuerpo: unknown): Promise<T> {
  const res = await fetch(`${BASE}/api/${ruta}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  });
  if (!res.ok) throw new Error(`POST ${ruta} → ${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}

async function conectar(token = TOKEN): Promise<Client> {
  const cliente = new Client({ name: 'prueba-mcp', version: '1.0.0' });
  const transporte = new StreamableHTTPClientTransport(new URL(`${BASE}/mcp`), {
    requestInit: { headers: { Authorization: `Bearer ${token}` } },
  });
  await cliente.connect(transporte);
  return cliente;
}

/** Llama a una herramienta y devuelve el JSON del primer bloque de texto. */
async function llamar(cliente: Client, nombre: string, args: Record<string, unknown>) {
  const r = await cliente.callTool({ name: nombre, arguments: args });
  const texto = (r.content as { type: string; text: string }[])[0].text;
  return { isError: r.isError === true, texto, datos: r.isError ? undefined : JSON.parse(texto) };
}

describe('MCP de repuestos (punta a punta)', () => {
  let cliente: Client;
  let repuestoId: string;
  let proveedorId: string;
  let clienteId: string;

  beforeAll(async () => {
    const repuesto = await crear<{ id: string }>('repuestos', {
      sku: `MCP-${sufijo}`,
      nombre: `Filtro de aceite prueba MCP ${sufijo}`,
      marca: 'Bosch',
      categoria: 'filtros',
      precio: 25000,
      compatibilidad: [{ marca: 'Chevrolet', modelo: 'Spark', anioDesde: 2010, anioHasta: 2020 }],
    });
    const proveedor = await crear<{ id: string }>('proveedores', { nit: `900${sufijo}`, nombre: `Proveedor MCP ${sufijo}` });
    const comprador = await crear<{ id: string }>('clientes', {
      tipoDocumento: 'CC',
      documento: `10${sufijo}`,
      nombre: `Cliente MCP ${sufijo}`,
    });
    repuestoId = repuesto.id;
    proveedorId = proveedor.id;
    clienteId = comprador.id;
    cliente = await conectar();
  });

  afterAll(async () => {
    await cliente?.close();
  });

  it('rechaza peticiones sin token (401)', async () => {
    const res = await fetch(`${BASE}/mcp`, { method: 'POST' });
    expect(res.status).toBe(401);
  });

  it('lista las 13 herramientas de lectura y las 4 de escritura', async () => {
    const { tools } = await cliente.listTools();
    const nombres = tools.map((t) => t.name).sort();
    expect(nombres).toEqual([...LECTURA, ...ESCRITURA].sort());
  });

  it('busca el repuesto creado por texto y por vehículo', async () => {
    const porTexto = await llamar(cliente, 'buscar_repuestos', { texto: `MCP-${sufijo}` });
    expect(porTexto.datos.items.map((r: { id: string }) => r.id)).toContain(repuestoId);

    const porVehiculo = await llamar(cliente, 'buscar_repuestos_por_vehiculo', {
      vehiculoMarca: 'Chevrolet',
      vehiculoModelo: 'Spark',
      vehiculoAnio: 2015,
      texto: sufijo,
    });
    expect(porVehiculo.datos.items.map((r: { id: string }) => r.id)).toContain(repuestoId);
  });

  it('compra: sin confirmar solo resume; confirmada suma 10 al stock', async () => {
    const args = { proveedorId, lineas: [{ repuestoId, cantidad: 10, costoUnitario: 15000 }] };

    const resumen = await llamar(cliente, 'registrar_compra', { ...args, confirmado: false });
    expect(resumen.datos.requiereConfirmacion).toBe(true);
    expect(resumen.datos.resumen.total).toBe(150000);
    const antes = await llamar(cliente, 'consultar_stock', { repuestoId });
    expect(antes.datos.totalDisponible ?? 0).toBe(0);

    const hecha = await llamar(cliente, 'registrar_compra', { ...args, confirmado: true });
    expect(hecha.isError).toBe(false);
    expect(hecha.datos.ejecutado).toBe(true);
    expect(hecha.datos.compra.numero).toMatch(/^C-\d{6}$/);

    const despues = await llamar(cliente, 'consultar_stock', { repuestoId });
    expect(despues.datos.totalDisponible).toBe(10);
  });

  it('venta: sin confirmar solo resume; confirmada descuenta 3 del stock', async () => {
    const args = { clienteId, lineas: [{ repuestoId, cantidad: 3 }] };

    const resumen = await llamar(cliente, 'registrar_venta', { ...args, confirmado: false });
    expect(resumen.datos.requiereConfirmacion).toBe(true);
    expect(resumen.datos.resumen.total).toBe(75000);
    expect(resumen.datos.resumen.lineas[0].alcanza).toBe(true);

    const hecha = await llamar(cliente, 'registrar_venta', { ...args, confirmado: true });
    expect(hecha.isError).toBe(false);
    expect(hecha.datos.venta.numero).toMatch(/^V-\d{6}$/);

    const stock = await llamar(cliente, 'consultar_stock', { repuestoId });
    expect(stock.datos.totalDisponible).toBe(7);
  });

  it('venta con stock insuficiente: error legible (409) y el stock no cambia', async () => {
    const args = { clienteId, lineas: [{ repuestoId, cantidad: 999 }] };

    const resumen = await llamar(cliente, 'registrar_venta', { ...args, confirmado: false });
    expect(resumen.datos.advertencia).toBeDefined();

    const fallida = await llamar(cliente, 'registrar_venta', { ...args, confirmado: true });
    expect(fallida.isError).toBe(true);
    expect(fallida.texto).toMatch(/^Conflicto con las reglas del negocio/);

    const stock = await llamar(cliente, 'consultar_stock', { repuestoId });
    expect(stock.datos.totalDisponible).toBe(7);
  });

  it('id inexistente: error legible de "No existe"', async () => {
    const r = await llamar(cliente, 'obtener_repuesto', { id: '00000000-0000-4000-8000-000000000000' });
    expect(r.isError).toBe(true);
    expect(r.texto).toMatch(/^No existe/);
  });
});
