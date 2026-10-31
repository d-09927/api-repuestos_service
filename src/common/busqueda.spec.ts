import { palabrasDeBusqueda, sinTildes } from './busqueda';

describe('busqueda', () => {
  it('quita tildes y pasa a minúsculas', () => {
    expect(sinTildes('Bujía ÁCIDO Pequeño')).toBe('bujia acido pequeno');
  });

  it('separa en palabras, quita las vacías y la "s" del plural', () => {
    expect(palabrasDeBusqueda('Bujías de iridio')).toEqual(['bujia', 'iridio']);
    expect(palabrasDeBusqueda('pastillas  para   los frenos')).toEqual(['pastilla', 'freno']);
  });

  it('no recorta palabras cortas ni códigos', () => {
    expect(palabrasDeBusqueda('gas tres')).toEqual(['gas', 'tres']);
    expect(palabrasDeBusqueda('PAS-DEL-CER')).toEqual(['pas-del-cer']);
  });

  it('un texto de solo palabras vacías no deja nada', () => {
    expect(palabrasDeBusqueda(' de la ')).toEqual([]);
  });
});
