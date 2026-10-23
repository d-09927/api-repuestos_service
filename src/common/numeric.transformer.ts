import { ValueTransformer } from 'typeorm';

/** Postgres devuelve los `numeric` como string; aquí los volvemos number. */
export const numericTransformer: ValueTransformer = {
  to: (valor?: number | null) => valor,
  from: (valor?: string | null) =>
    valor === null || valor === undefined ? valor : parseFloat(valor),
};
