import { Candidato, desglosarIva, ordenarOfertas } from './cotizacion.herramientas';

const candidato = (sku: string, precio: number, disponible: number): Candidato => ({
  sku,
  nombre: sku,
  marca: sku,
  precio,
  disponible,
  bodegas: [],
});

describe('consultar_precio_repuesto', () => {
  describe('ordenarOfertas', () => {
    it('entre las que alcanzan, primero la más barata', () => {
      const r = ordenarOfertas([candidato('CARA', 190000, 10), candidato('BARATA', 172050, 5)], 2);
      expect(r.map((c) => c.sku)).toEqual(['BARATA', 'CARA']);
    });

    it('una que alcanza va antes que una más barata que no alcanza', () => {
      const r = ordenarOfertas([candidato('BARATA-SIN', 100000, 1), candidato('CARA-CON', 150000, 4)], 2);
      expect(r.map((c) => c.sku)).toEqual(['CARA-CON', 'BARATA-SIN']);
    });

    it('si ninguna alcanza, primero la de más unidades', () => {
      const r = ordenarOfertas([candidato('UNA', 100000, 1), candidato('TRES', 150000, 3)], 5);
      expect(r.map((c) => c.sku)).toEqual(['TRES', 'UNA']);
    });

    it('a igual precio, la de más unidades', () => {
      const r = ordenarOfertas([candidato('POCAS', 50000, 2), candidato('MUCHAS', 50000, 20)], 1);
      expect(r.map((c) => c.sku)).toEqual(['MUCHAS', 'POCAS']);
    });

    it('no modifica el arreglo recibido', () => {
      const lista = [candidato('B', 2, 5), candidato('A', 1, 5)];
      ordenarOfertas(lista, 1);
      expect(lista.map((c) => c.sku)).toEqual(['B', 'A']);
    });
  });

  describe('desglosarIva', () => {
    it('precio_unitario va SIN IVA (lo que pide facturación); el precio con IVA y el IVA van aparte', () => {
      expect(desglosarIva(119000, 19)).toEqual({ precio_unitario: 100000, precio_unitario_con_iva: 119000, iva_unitario: 19000 });
    });

    it('redondea al peso y la suma siempre cuadra con el precio', () => {
      const d = desglosarIva(172050.4, 19);
      expect(d.precio_unitario_con_iva).toBe(172050);
      expect(d.precio_unitario + d.iva_unitario).toBe(d.precio_unitario_con_iva);
    });

    it('con IVA 0 el precio sin IVA es el mismo', () => {
      expect(desglosarIva(25000, 0)).toEqual({ precio_unitario: 25000, precio_unitario_con_iva: 25000, iva_unitario: 0 });
    });
  });
});
