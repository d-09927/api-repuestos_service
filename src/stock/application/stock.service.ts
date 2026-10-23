import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { NotFoundError, ValidationDomainError } from '../../common/domain-error';
import { UnidadDeTrabajoPort } from '../../common/unidad-de-trabajo/unidad-de-trabajo.port';
import { StockItem } from '../domain/entities/stock-item.entity';
import { StockConcurrenteError } from '../domain/errors/stock-concurrente.error';
import { StockInsuficienteError } from '../domain/errors/stock-insuficiente.error';
import {
  MovimientoServicePort,
  RegistroMovimiento,
  TipoMovimientoStock,
} from '../domain/ports/movimiento.service.port';
import { RepuestoServicePort } from '../domain/ports/repuesto.service.port';
import { StockRepositoryPort } from '../domain/ports/stock.repository.port';
import { ConsultaStock } from './dto/consulta-stock.result';
import { MovimientoLoteCommand } from './dto/movimiento-lote.command';
import {
  AjusteStockCommand,
  EntradaStockCommand,
  MovimientoStockCommand,
  SalidaStockCommand,
} from './dto/movimiento-stock.command';

/** Motivo y referencia opcionales que acompañan a un movimiento. */
type Datos = { motivo?: string | null; referencia?: string | null };

/**
 * Casos de uso y reglas de stock. Cada operación bloquea la fila, aplica la regla,
 * guarda el stock y registra el movimiento, todo en una sola transacción.
 */
@Injectable()
export class StockService {
  constructor(
    private readonly stocks: StockRepositoryPort,
    private readonly movimientos: MovimientoServicePort,
    private readonly repuestos: RepuestoServicePort,
    private readonly unidadDeTrabajo: UnidadDeTrabajoPort,
  ) {}

  async registrarEntrada(cmd: EntradaStockCommand): Promise<StockItem> {
    await this.repuestos.verificarRepuestoActivo(cmd.repuestoId);
    const bodega = this.normalizarBodega(cmd.bodega);
    return this.transaccion(async () => {
      // La primera entrada a una bodega crea el registro de stock.
      const item = (await this.stocks.bloquear(cmd.repuestoId, bodega)) ?? this.nuevo(cmd.repuestoId, bodega);
      this.configurar(item, cmd.minimo, cmd.ubicacion);
      return this.guardarConMovimiento(item, this.entrada(item, cmd.cantidad, cmd));
    });
  }

  registrarSalida(cmd: SalidaStockCommand): Promise<StockItem> {
    return this.sobreExistente(cmd, (s) => this.salida(s, cmd.cantidad, cmd.desdeReserva ?? false, cmd));
  }

  reservar(cmd: MovimientoStockCommand): Promise<StockItem> {
    return this.sobreExistente(cmd, (s) => this.reserva(s, cmd.cantidad, cmd));
  }

  liberarReserva(cmd: MovimientoStockCommand): Promise<StockItem> {
    return this.sobreExistente(cmd, (s) => this.liberacion(s, cmd.cantidad, cmd));
  }

  ajustar(cmd: AjusteStockCommand): Promise<StockItem> {
    return this.sobreExistente(cmd, (s) => this.ajuste(s, cmd.cantidadNueva, cmd));
  }

  /** Suma las unidades de varias líneas (compras). Todo o nada. */
  registrarEntradas(cmd: MovimientoLoteCommand): Promise<void> {
    const bodega = this.normalizarBodega(cmd.bodega);
    return this.lote(bodega, cmd, (actual, linea) => {
      const stock = actual ?? this.nuevo(linea.repuestoId, bodega);
      return { stock, movimiento: this.entrada(stock, linea.cantidad, cmd) };
    });
  }

  /** Resta las unidades disponibles de varias líneas (ventas). Si una no alcanza, no se mueve nada. */
  registrarSalidas(cmd: MovimientoLoteCommand): Promise<void> {
    const bodega = this.normalizarBodega(cmd.bodega);
    return this.lote(bodega, cmd, (actual, linea) => {
      const stock = this.requerir(actual, linea.repuestoId, bodega);
      return { stock, movimiento: this.salida(stock, linea.cantidad, false, cmd) };
    });
  }

  /** Stock de un repuesto en todas las bodegas. */
  async consultarPorRepuesto(repuestoId: string): Promise<ConsultaStock> {
    const bodegas = await this.stocks.listarPorRepuesto(repuestoId);
    return {
      repuestoId,
      totalFisico: bodegas.reduce((suma, s) => suma + s.cantidad, 0),
      totalDisponible: bodegas.reduce((suma, s) => suma + this.disponible(s), 0),
      bodegas,
    };
  }

  /** Repuestos que hay que reponer. */
  stockBajo(): Promise<StockItem[]> {
    return this.stocks.listarBajoMinimo();
  }

  // --- reglas de stock ---

  /** Lo que realmente se puede vender o entregar: físico menos reservado. */
  disponible(s: StockItem): number {
    return s.cantidad - s.reservada;
  }

  private normalizarBodega(bodega: string): string {
    const limpia = (bodega ?? '').trim().toUpperCase();
    if (!limpia) throw new ValidationDomainError('La bodega es obligatoria');
    if (limpia.length > 50) throw new ValidationDomainError('La bodega no puede superar 50 caracteres');
    return limpia;
  }

  private cantidadPositiva(cantidad: number): number {
    if (!Number.isInteger(cantidad) || cantidad <= 0) {
      throw new ValidationDomainError('La cantidad debe ser un entero mayor que 0');
    }
    return cantidad;
  }

  private nuevo(repuestoId: string, bodega: string): StockItem {
    return new StockItem({
      id: randomUUID(),
      repuestoId,
      bodega,
      cantidad: 0,
      reservada: 0,
      minimo: 0,
      ubicacion: null,
      actualizadoEn: new Date(),
    });
  }

  /** Salidas, reservas y ajustes exigen que ya haya stock registrado en esa bodega. */
  private requerir(actual: StockItem | null, repuestoId: string, bodega: string): StockItem {
    if (!actual) {
      throw new NotFoundError(`No hay stock registrado del repuesto ${repuestoId} en la bodega ${bodega}`);
    }
    return actual;
  }

  private configurar(s: StockItem, minimo?: number, ubicacion?: string): void {
    if (minimo !== undefined) {
      if (!Number.isInteger(minimo) || minimo < 0) {
        throw new ValidationDomainError('El stock mínimo debe ser un entero mayor o igual a 0');
      }
      s.minimo = minimo;
    }
    if (ubicacion !== undefined) s.ubicacion = ubicacion.trim() || null;
    s.actualizadoEn = new Date();
  }

  private entrada(s: StockItem, cantidad: number, datos: Datos): RegistroMovimiento {
    s.cantidad += this.cantidadPositiva(cantidad);
    return this.movimiento(s, 'ENTRADA', cantidad, datos);
  }

  /**
   * - desdeReserva = false: salen de lo disponible (venta de mostrador).
   * - desdeReserva = true:  se entrega algo que ya estaba reservado (pedido u orden de trabajo).
   */
  private salida(s: StockItem, cantidad: number, desdeReserva: boolean, datos: Datos): RegistroMovimiento {
    this.cantidadPositiva(cantidad);
    if (desdeReserva) {
      if (cantidad > s.reservada) {
        throw new StockInsuficienteError(`Solo hay ${s.reservada} unidad(es) reservada(s) y se piden ${cantidad}`);
      }
      s.reservada -= cantidad;
    } else if (cantidad > this.disponible(s)) {
      throw new StockInsuficienteError(
        `Solo hay ${this.disponible(s)} unidad(es) disponible(s) y se piden ${cantidad}`,
      );
    }
    s.cantidad -= cantidad;
    return this.movimiento(s, 'SALIDA', cantidad, datos);
  }

  private reserva(s: StockItem, cantidad: number, datos: Datos): RegistroMovimiento {
    this.cantidadPositiva(cantidad);
    if (cantidad > this.disponible(s)) {
      throw new StockInsuficienteError(
        `Solo hay ${this.disponible(s)} unidad(es) disponible(s) y se piden ${cantidad}`,
      );
    }
    s.reservada += cantidad;
    return this.movimiento(s, 'RESERVA', cantidad, datos);
  }

  private liberacion(s: StockItem, cantidad: number, datos: Datos): RegistroMovimiento {
    this.cantidadPositiva(cantidad);
    if (cantidad > s.reservada) {
      throw new StockInsuficienteError(
        `Solo hay ${s.reservada} unidad(es) reservada(s) y se quieren liberar ${cantidad}`,
      );
    }
    s.reservada -= cantidad;
    return this.movimiento(s, 'LIBERACION', cantidad, datos);
  }

  /** Corrige la cantidad física (conteo, merma...). La cantidad del movimiento es la diferencia. */
  private ajuste(s: StockItem, cantidadNueva: number, datos: Datos): RegistroMovimiento {
    if (!Number.isInteger(cantidadNueva) || cantidadNueva < 0) {
      throw new ValidationDomainError('La cantidad nueva debe ser un entero mayor o igual a 0');
    }
    if (cantidadNueva < s.reservada) {
      throw new StockInsuficienteError(
        `No se puede ajustar a ${cantidadNueva}: hay ${s.reservada} unidad(es) reservada(s)`,
      );
    }
    const diferencia = cantidadNueva - s.cantidad;
    s.cantidad = cantidadNueva;
    return this.movimiento(s, 'AJUSTE', diferencia, datos);
  }

  private movimiento(
    s: StockItem,
    tipo: TipoMovimientoStock,
    cantidad: number,
    datos: Datos,
  ): RegistroMovimiento {
    s.actualizadoEn = new Date();
    return {
      repuestoId: s.repuestoId,
      bodega: s.bodega,
      tipo,
      cantidad,
      cantidadResultante: s.cantidad,
      motivo: datos.motivo?.trim() || null,
      referencia: datos.referencia?.trim() || null,
    };
  }

  // --- orquestación ---

  private sobreExistente(
    cmd: { repuestoId: string; bodega: string },
    accion: (stock: StockItem) => RegistroMovimiento,
  ): Promise<StockItem> {
    const bodega = this.normalizarBodega(cmd.bodega);
    return this.transaccion(async () => {
      const item = this.requerir(await this.stocks.bloquear(cmd.repuestoId, bodega), cmd.repuestoId, bodega);
      return this.guardarConMovimiento(item, accion(item));
    });
  }

  private async lote(
    bodega: string,
    cmd: MovimientoLoteCommand,
    aplicar: (
      actual: StockItem | null,
      linea: { repuestoId: string; cantidad: number },
    ) => { stock: StockItem; movimiento: RegistroMovimiento },
  ): Promise<void> {
    await this.transaccion(async () => {
      const ids = [...new Set(cmd.lineas.map((l) => l.repuestoId))].sort();
      const actuales = await this.stocks.bloquearVarios(bodega, ids);
      // Si cualquier línea lanza error, la transacción completa se revierte.
      const resultados = cmd.lineas.map((linea) => aplicar(actuales.get(linea.repuestoId) ?? null, linea));
      for (const { stock } of resultados) await this.stocks.guardar(stock);
      await this.movimientos.registrar(resultados.map((r) => r.movimiento));
    });
  }

  private async guardarConMovimiento(item: StockItem, movimiento: RegistroMovimiento): Promise<StockItem> {
    await this.stocks.guardar(item);
    await this.movimientos.registrar([movimiento]);
    return item;
  }

  /**
   * Transacción con un reintento: si dos primeras entradas simultáneas crean la misma fila,
   * una gana y la otra reintenta, ya encontrando la fila para bloquearla.
   */
  private async transaccion<T>(trabajo: () => Promise<T>): Promise<T> {
    try {
      return await this.unidadDeTrabajo.ejecutar(trabajo);
    } catch (error) {
      if (error instanceof StockConcurrenteError) return this.unidadDeTrabajo.ejecutar(trabajo);
      throw error;
    }
  }
}
