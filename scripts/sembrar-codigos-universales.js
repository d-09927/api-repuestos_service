/*
 * Carga en el catálogo los 15 códigos universales de repuesto del contrato del taller
 * (hoja Catálogos de MCP-Taller.xlsx), con una o dos marcas por código y stock inicial.
 * Usa la API REST, así que pasa por las mismas validaciones. Se puede correr varias veces:
 * un SKU que ya existe no se duplica ni recibe stock otra vez.
 *
 *   npm run start:dev            (en otra terminal)
 *   npm run sembrar:codigos
 *
 * Precios en pesos colombianos CON IVA. PAS-DEL-CER y AMO-DEL-GAS usan los precios de los
 * ejemplos de facturación para que las pruebas entre equipos cuadren.
 */
const BASE = process.env.BASE_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;

// [codigo, sistema (categoría), nombre, [[marca, prefijo SKU, precio, unidades], ...]]
const CATALOGO = [
  ['ACE-5W30-1L', 'Lubricantes', 'Aceite sintético 5W-30, 1 litro', [['Mobil', 'MOB', 42000, 40], ['Castrol', 'CAS', 45500, 25]]],
  ['ALT-90A-STD', 'Eléctrico', 'Alternador 90 A', [['Bosch', 'BOS', 620000, 0]]],
  ['AMO-DEL-GAS', 'Suspensión', 'Amortiguador delantero a gas', [['Monroe', 'MON', 288300, 6], ['KYB', 'KYB', 265000, 1]]],
  ['AMO-TRA-GAS', 'Suspensión', 'Amortiguador trasero a gas', [['Monroe', 'MON', 245000, 4]]],
  ['BAT-12V-60AH', 'Eléctrico', 'Batería 12 V 60 Ah', [['MAC', 'MAC', 385000, 5], ['Willard', 'WIL', 362000, 3]]],
  ['BOB-ENC-STD', 'Motor', 'Bobina de encendido', [['Bosch', 'BOS', 158000, 8]]],
  ['BUJ-IRI-STD', 'Motor', 'Bujía de iridio', [['NGK', 'NGK', 48500, 30], ['Denso', 'DEN', 46000, 12]]],
  ['DIS-DEL-VENT', 'Frenos', 'Disco de freno delantero ventilado', [['Brembo', 'BRE', 215000, 6]]],
  ['FIL-ACE-STD', 'Filtros', 'Filtro de aceite estándar', [['Bosch', 'BOS', 25000, 20], ['Mann', 'MAN', 23500, 15]]],
  ['FIL-AIRE-STD', 'Filtros', 'Filtro de aire de motor', [['Mann', 'MAN', 52000, 10]]],
  ['KIT-EMB-STD', 'Transmisión', 'Kit de embrague (disco, prensa y balinera)', [['LUK', 'LUK', 890000, 2]]],
  ['LIQ-FRE-DOT4', 'Frenos', 'Líquido de frenos DOT 4, 500 ml', [['Bosch', 'BOS', 28000, 24]]],
  ['PAS-DEL-CER', 'Frenos', 'Juego de pastillas delanteras cerámicas', [['Bosch', 'BOS', 172050, 8], ['Brembo', 'BRE', 189000, 4]]],
  ['PAS-TRA-CER', 'Frenos', 'Juego de pastillas traseras cerámicas', [['Bosch', 'BOS', 148000, 6]]],
  ['SEN-OXI-STD', 'Motor', 'Sensor de oxígeno', [['Bosch', 'BOS', 235000, 3]]],
];

async function post(ruta, cuerpo) {
  const r = await fetch(`${BASE}/api${ruta}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  });
  return { status: r.status, cuerpo: await r.json().catch(() => null) };
}

async function main() {
  let creados = 0;
  let existentes = 0;
  for (const [codigo, categoria, nombre, marcas] of CATALOGO) {
    for (const [marca, prefijo, precio, unidades] of marcas) {
      const sku = `${prefijo}-${codigo}`;
      const r = await post('/repuestos', { sku, codigoUniversal: codigo, nombre: `${nombre} ${marca}`, marca, categoria, precio });
      if (r.status === 409) {
        existentes++;
        console.log(`  ya existía ${sku}`);
        continue;
      }
      if (r.status !== 201) throw new Error(`No se pudo crear ${sku}: ${r.status} ${JSON.stringify(r.cuerpo)}`);
      creados++;
      if (unidades > 0) {
        const e = await post('/stock/entradas', {
          repuestoId: r.cuerpo.id,
          bodega: 'PRINCIPAL',
          cantidad: unidades,
          minimo: 2,
          motivo: 'Inventario inicial',
          referencia: 'SEMILLA-CODIGOS',
        });
        if (e.status !== 201) throw new Error(`No se pudo dar entrada a ${sku}: ${e.status} ${JSON.stringify(e.cuerpo)}`);
      }
      console.log(`  ${sku}  $${precio.toLocaleString('es-CO')}  ${unidades} u.`);
    }
  }
  console.log(`Listo: ${creados} creados, ${existentes} ya existían (${CATALOGO.length} códigos universales).`);
}

main().catch((error) => {
  console.error(error.message);
  if (error.cause?.code === 'ECONNREFUSED') console.error(`¿Está la API levantada en ${BASE}?`);
  process.exit(1);
});
