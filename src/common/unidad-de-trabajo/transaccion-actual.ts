import { AsyncLocalStorage } from 'async_hooks';
import { EntityManager, ObjectLiteral, Repository } from 'typeorm';

const almacen = new AsyncLocalStorage<EntityManager>();

/** Corre `trabajo` con `manager` como transacción actual. */
export function conTransaccion<T>(manager: EntityManager, trabajo: () => Promise<T>): Promise<T> {
  return almacen.run(manager, trabajo);
}

/** El manager de la transacción en curso (si la hay). */
export function transaccionActual(): EntityManager | undefined {
  return almacen.getStore();
}

/**
 * Devuelve el repositorio que deben usar los adaptadores: el de la transacción actual
 * si hay una abierta, o el repositorio normal si no.
 */
export function repoActual<T extends ObjectLiteral>(base: Repository<T>): Repository<T> {
  const manager = almacen.getStore();
  return manager ? manager.getRepository(base.target) : base;
}
