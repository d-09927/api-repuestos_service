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
  'consultar_precio_repuesto',
  'catalogo_repuestos',
  'hablar_con_repuestos',
  'consultar_orden',
];
const ESCRITURA = [
  'reservar_repuesto',
  'liberar_reserva',
  'registrar_venta',
  'registrar_compra',
  'despachar_orden',
  'cancelar_orden',
  'registrar_pago_orden',
];

// Lo que se crea en catálogo y personas: al terminar se desactiva, para no dejarlo a la vista.
const creados: string[] = [];

async function crear<T>(ruta: string, cuerpo: unknown): Promise<T> {
  const res = await fetch(`${BASE}/api/${ruta}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  });
  if (!res.ok) throw new Error(`POST ${ruta} → ${res.status}: ${await res.text()}`);
  const creado = await res.json();
  if (['repuestos', 'proveedores', 'clientes'].includes(ruta)) creados.push(`${ruta}/${creado.id}`);
  return creado as T;
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
    await Promise.all(creados.map((ruta) => fetch(`${BASE}/api/${ruta}`, { method: 'DELETE' })));
  });

  it('rechaza peticiones sin token (401)', async () => {
    const res = await fetch(`${BASE}/mcp`, { method: 'POST' });
    expect(res.status).toBe(401);
  });

  it('lista las 17 herramientas de lectura y las 8 de escritura', async () => {
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

  describe('pedido de una orden (lo que usa nuestro agente con facturación)', () => {
    const codigo = `PED-${sufijo}`.toUpperCase();
    const orden = `OT-E2E-${sufijo}`.toUpperCase();
    let repuestoPedido: string;

    const stockDe = async () => {
      const r = await fetch(`${BASE}/api/stock/repuestos/${repuestoPedido}`);
      const s = (await r.json()) as { bodegas: { cantidad: number; reservada: number }[] };
      return { fisico: s.bodegas[0].cantidad, reservada: s.bodegas[0].reservada };
    };

    beforeAll(async () => {
      const r = await crear<{ id: string }>('repuestos', {
        sku: `PED-${sufijo}`, codigoUniversal: codigo, nombre: 'Amortiguador prueba pedido', marca: 'Monroe', categoria: 'Suspensión', precio: 119000,
      });
      repuestoPedido = r.id;
      await crear('stock/entradas', { repuestoId: r.id, bodega: 'PRINCIPAL', cantidad: 5, referencia: 'E2E' });
    });

    type Venta = { numero: string; estado: string; referenciaPago: string | null };
    const ventaNumero = async (numero: string) =>
      ((await (await fetch(`${BASE}/api/ventas?limite=100`)).json()) as { items: Venta[] }).items.find((v) => v.numero === numero);

    it('el cliente aceptó → DESPACHADO con factura PENDIENTE_PAGO → facturación paga → PAGADO', async () => {
      const despachado = await llamar(cliente, 'despachar_orden', {
        codigo_orden: orden, lineas: [{ codigo_repuesto: codigo, cantidad: 3 }], id_mensaje: `${orden}-despachar`,
      });
      expect(despachado.isError).toBe(false);
      expect(despachado.datos).toMatchObject({
        codigo_orden: orden,
        estado: 'DESPACHADO',
        lineas: [{ cantidad_apartada: 3, cantidad_entregada: 3, precio_unitario: 100000 }],
        total_a_cobrar_con_iva: 357000,
        total_a_cobrar_sin_iva: 300000,
      });
      const numero = despachado.datos.ventas[0].numero;
      expect(numero).toMatch(/^V-\d{6}$/);
      expect(await ventaNumero(numero)).toMatchObject({ estado: 'PENDIENTE_PAGO', referenciaPago: null });
      // Salieron 3 del físico y no queda nada reservado.
      expect(await stockDe()).toEqual({ fisico: 2, reservada: 0 });

      // Reintento con el mismo id_mensaje: no despacha ni factura otra vez.
      await llamar(cliente, 'despachar_orden', {
        codigo_orden: orden, lineas: [{ codigo_repuesto: codigo, cantidad: 3 }], id_mensaje: `${orden}-despachar`,
      });
      expect(await stockDe()).toEqual({ fisico: 2, reservada: 0 });

      // Despachado ya tiene factura: no se cancela.
      const cancelar = await llamar(cliente, 'cancelar_orden', { codigo_orden: orden, id_mensaje: `${orden}-c` });
      expect(cancelar.isError).toBe(true);

      const pagado = await llamar(cliente, 'registrar_pago_orden', {
        codigo_orden: orden, referencia_pago: 'PSE-E2E', id_mensaje: `${orden}-pago`,
      });
      expect(pagado.datos).toMatchObject({ estado: 'PAGADO', referencia_pago: 'PSE-E2E' });
      expect(await ventaNumero(numero)).toMatchObject({ estado: 'PAGADA', referenciaPago: 'PSE-E2E' });
    });

    it('no se despacha más de lo que hay en una bodega, y no se toca nada', async () => {
      const demasiado = await llamar(cliente, 'despachar_orden', {
        codigo_orden: `${orden}-X`, lineas: [{ codigo_repuesto: codigo, cantidad: 99 }], id_mensaje: `${orden}-x`,
      });
      expect(demasiado.isError).toBe(true);
      expect(demasiado.texto).toMatch(/en una misma bodega/);
      expect(await stockDe()).toEqual({ fisico: 2, reservada: 0 });
    });
  });

  describe('consultar_precio_repuesto (para facturación)', () => {
    const codigo = `TST-${sufijo}`.toUpperCase();

    beforeAll(async () => {
      // Dos marcas con el mismo código universal: la cara tiene stock, la barata no.
      const conStock = await crear<{ id: string }>('repuestos', {
        sku: `CON-${sufijo}`, codigoUniversal: codigo, nombre: 'Pastillas prueba con stock', marca: 'Bosch', categoria: 'Frenos', precio: 119000,
      });
      await crear('repuestos', {
        sku: `SIN-${sufijo}`, codigoUniversal: codigo, nombre: 'Pastillas prueba sin stock', marca: 'Genérica', categoria: 'Frenos', precio: 100000,
      });
      await crear('stock/entradas', { repuestoId: conStock.id, bodega: 'NORTE', cantidad: 5, referencia: 'E2E' });
    });

    it('ofrece la marca que alcanza, con precio SIN IVA y la bodega', async () => {
      const r = await llamar(cliente, 'consultar_precio_repuesto', { codigo_repuesto: codigo.toLowerCase(), cantidad: 2 });

      expect(r.isError).toBe(false);
      expect(r.datos).toMatchObject({
        codigo_repuesto: codigo,
        cantidad: 2,
        tienda: expect.any(String),
        precio_unitario: 100000,
        precio_incluye_iva: false,
        precio_unitario_con_iva: 119000,
        iva_unitario: 19000,
        disponible: true,
        unidades_disponibles: 5,
        repuesto: { sku: `CON-${sufijo}`.toUpperCase() },
        bodegas: [{ bodega: 'NORTE', disponible: 5 }],
      });
      expect(r.datos.alternativas).toEqual([expect.objectContaining({ sku: `SIN-${sufijo}`.toUpperCase(), disponible: false })]);
    });

    it('si no alcanza responde disponible=false con el motivo (no es un error)', async () => {
      const r = await llamar(cliente, 'consultar_precio_repuesto', { codigo_repuesto: codigo, cantidad: 10 });

      expect(r.isError).toBe(false);
      expect(r.datos.disponible).toBe(false);
      expect(r.datos.mensaje).toMatch(/Solo hay 5/);
    });

    it('un código que no manejamos responde precio null y disponible=false', async () => {
      const r = await llamar(cliente, 'consultar_precio_repuesto', { codigo_repuesto: `NO-EXISTE-${sufijo}`, cantidad: 1 });

      expect(r.isError).toBe(false);
      expect(r.datos).toMatchObject({ disponible: false, precio_unitario: null, mensaje: expect.stringMatching(/no maneja/) });
    });

    it('catalogo_repuestos lista el código una sola vez, solo con la marca que tiene unidades', async () => {
      const r = await llamar(cliente, 'catalogo_repuestos', { categoria: 'frenos' });

      expect(r.isError).toBe(false);
      expect(r.datos.precio_incluye_iva).toBe(false);
      const nuestros = r.datos.repuestos.filter((i: { codigo_repuesto: string }) => i.codigo_repuesto === codigo);
      expect(nuestros).toEqual([
        {
          codigo_repuesto: codigo,
          nombre: 'Pastillas prueba con stock',
          categoria: 'Frenos',
          marcas: ['Bosch'],
          unidades_disponibles: 5,
          precio_desde: 100000,
        },
      ]);
    });
  });

  describe('AutoMax: consultar_compras_vin con su propio token', () => {
    const TOKEN_AUTOMAX = process.env.MCP_TOKEN_AUTOMAX ?? 'dev-token-automax-0001';
    // Un VIN único por corrida: base 36 sin I, O ni Q, completado hasta 17.
    const vin = `E2E${sufijo.toUpperCase().replace(/[IOQ]/g, '0')}`.padEnd(17, '1');
    let automax: Client;

    beforeAll(async () => {
      const repuesto = await crear<{ id: string }>('repuestos', {
        sku: `GAR-${sufijo}`, codigoUniversal: `GAR-${sufijo}`, nombre: 'Amortiguador prueba garantía', marca: 'Monroe', categoria: 'Suspensión', precio: 100000,
      });
      await crear('stock/entradas', { repuestoId: repuesto.id, bodega: 'PRINCIPAL', cantidad: 2, referencia: 'E2E' });
      await crear('ventas', { vin, lineas: [{ repuestoId: repuesto.id, cantidad: 1 }] });
      automax = await conectar(TOKEN_AUTOMAX);
    });

    afterAll(async () => {
      await automax?.close();
    });

    it('la salud responde sin token', async () => {
      const res = await fetch(`${BASE}/api/salud`);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ estado: 'ok' });
    });

    it('con su token solo ve esa herramienta; con el general no aparece', async () => {
      expect((await automax.listTools()).tools.map((t) => t.name)).toEqual(['consultar_compras_vin']);
      expect((await cliente.listTools()).tools.map((t) => t.name)).not.toContain('consultar_compras_vin');
    });

    it('con compra de esa categoría la devuelve, sin datos personales y con fecha -05:00', async () => {
      const r = await llamar(automax, 'consultar_compras_vin', { vin: vin.toLowerCase(), categoria: 'suspension' });

      expect(r.isError).toBe(false);
      expect(r.datos.compras).toEqual([
        {
          fecha: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}-05:00$/),
          codigo_repuesto: `GAR-${sufijo}`.toUpperCase(),
          categoria: 'suspension',
          descripcion: 'Amortiguador prueba garantía',
          cantidad: 1,
          origen: 'mostrador',
          codigo_orden: null,
        },
      ]);
    });

    it('sin compras de esa categoría responde la lista vacía', async () => {
      const r = await llamar(automax, 'consultar_compras_vin', { vin, categoria: 'frenos' });

      expect(r.datos).toEqual({ compras: [] });
    });

    it('VIN mal formado o categoría desconocida: isError con mensaje en español', async () => {
      const malVin = await llamar(automax, 'consultar_compras_vin', { vin: 'ABC', categoria: 'frenos' });
      const malaCategoria = await llamar(automax, 'consultar_compras_vin', { vin, categoria: 'llantas' });

      expect(malVin.isError).toBe(true);
      expect(malVin.texto).toMatch(/VIN/);
      expect(malaCategoria.isError).toBe(true);
      expect(malaCategoria.texto).toMatch(/Categoría desconocida/);
    });

    it('un token falso responde 401', async () => {
      const res = await fetch(`${BASE}/mcp`, { method: 'POST', headers: { Authorization: 'Bearer token-falso-de-prueba' } });
      expect(res.status).toBe(401);
    });
  });

  it('id inexistente: error legible de "No existe"', async () => {
    const r = await llamar(cliente, 'obtener_repuesto', { id: '00000000-0000-4000-8000-000000000000' });
    expect(r.isError).toBe(true);
    expect(r.texto).toMatch(/^No existe/);
  });
});
