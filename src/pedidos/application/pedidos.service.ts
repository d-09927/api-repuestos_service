import { randomUUID } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConflictError, NotFoundError, ValidationDomainError } from '../../common/domain-error';
import { textoObligatorio } from '../../common/validaciones';
import { normalizarVin } from '../../common/vin';
import { LineaPedido, Pedido } from '../domain/entities/pedido.entity';
import { EstadoPedido } from '../domain/enums/estado-pedido.enum';
import { ClienteServicePort } from '../domain/ports/cliente.service.port';
import { PedidoRepositoryPort } from '../domain/ports/pedido.repository.port';
import { RepuestoServicePort } from '../domain/ports/repuesto.service.port';
import { MovimientoDePedido, StockServicePort } from '../domain/ports/stock.service.port';
import { VentaServicePort } from '../domain/ports/venta.service.port';
import {
  CancelarPedidoCommand,
  DespacharPedidoCommand,
  LineaCodigoCommand,
  PagarPedidoCommand,
} from './dto/pedido.commands';

const MAX_LINEAS = 50;

/**
 * Casos de uso de los pedidos de una orden de taller: despachar (el cliente aceptó la cotización:
 * aparta y genera la venta por cobrar), registrar el pago que hace facturación y cancelar lo apartado.
 */
@Injectable()
export class PedidosService {
  private readonly logger = new Logger(PedidosService.name);

  constructor(
    private readonly pedidos: PedidoRepositoryPort,
    private readonly repuestos: RepuestoServicePort,
    private readonly stock: StockServicePort,
    private readonly ventas: VentaServicePort,
    private readonly clientes: ClienteServicePort,
  ) {}

  /**
   * El cliente aceptó la cotización: aparta los repuestos y genera en el mismo paso la venta por
   * cobrar (PENDIENTE_PAGO) a facturación; el pedido queda DESPACHADO. Facturación paga después.
   *
   * Si la venta falla a mitad de camino el pedido queda APARTADO (con lo reservado) y lo vendido
   * guardado: un reintento termina de despachar sin vender dos veces. Lo mismo para un pedido
   * APARTADO de antes de este flujo.
   */
  async despachar(cmd: DespacharPedidoCommand): Promise<Pedido> {
    const codigoOrden = this.normalizarOrden(cmd.codigoOrden);
    const idMensaje = this.normalizarMensaje(cmd.idMensaje);
    const existente = await this.pedidos.buscarPorCodigoOrden(codigoOrden);
    if (existente?.mensajes.includes(idMensaje)) return existente;

    let pedido: Pedido;
    if (existente?.estado === EstadoPedido.APARTADO) {
      pedido = existente;
      if (cmd.vin != null) pedido.vin = normalizarVin(cmd.vin);
    } else {
      if (existente && existente.estado !== EstadoPedido.CANCELADO) {
        throw new ConflictError(`La orden ${codigoOrden} ya tiene un pedido ${existente.estado}`);
      }
      pedido = await this.apartar(existente, codigoOrden, cmd);
    }

    await this.venderLoApartado(pedido);
    pedido.estado = EstadoPedido.DESPACHADO;
    return this.guardar(pedido, idMensaje);
  }

  /** Reserva las unidades y guarda el pedido APARTADO (todavía sin el id_mensaje: falta despachar). */
  private async apartar(existente: Pedido | null, codigoOrden: string, cmd: DespacharPedidoCommand): Promise<Pedido> {
    const vin = cmd.vin == null ? null : normalizarVin(cmd.vin);
    const lineas = await this.elegir(this.validarLineas(cmd.lineas, 1));
    const movimientos = this.porBodega(lineas, codigoOrden, (l) => l.cantidadApartada);
    const apartados: MovimientoDePedido[] = [];
    try {
      for (const m of movimientos) {
        await this.stock.reservar(m);
        apartados.push(m);
      }
    } catch (error) {
      await this.liberarSinFallar(apartados);
      throw error;
    }

    const ahora = new Date();
    const pedido =
      existente ??
      new Pedido({
        id: randomUUID(),
        codigoOrden,
        vin,
        estado: EstadoPedido.APARTADO,
        lineas: [],
        ventas: [],
        mensajes: [],
        referenciaPago: null,
        creadoEn: ahora,
        actualizadoEn: ahora,
      });
    Object.assign(pedido, {
      vin,
      estado: EstadoPedido.APARTADO,
      lineas,
      ventas: [],
      referenciaPago: null,
      actualizadoEn: ahora,
    });
    try {
      await this.pedidos.guardar(pedido);
    } catch (error) {
      // Compensación: si el pedido no quedó guardado, lo apartado vuelve a disponible.
      await this.liberarSinFallar(apartados);
      throw error;
    }
    return pedido;
  }

  /**
   * Vende todo lo apartado (sale de lo reservado) como venta por cobrar, una por bodega. Guarda
   * después de cada venta: si una falla, las ya hechas no se repiten en el reintento.
   */
  private async venderLoApartado(pedido: Pedido): Promise<void> {
    for (const l of pedido.lineas) l.cantidadEntregada = l.cantidadApartada;
    const porVender = this.porBodega(pedido.lineas, pedido.codigoOrden, (l) => l.cantidadEntregada).filter(
      (m) => !pedido.ventas.some((v) => v.bodega === m.bodega),
    );
    if (!porVender.length) return;

    const clienteId = await this.clientes.comprador();
    for (const m of porVender) {
      pedido.ventas.push(
        await this.ventas.registrarPorCobrar({
          clienteId,
          codigoOrden: pedido.codigoOrden,
          vin: pedido.vin,
          bodega: m.bodega,
          observaciones: `Orden de taller ${pedido.codigoOrden}`,
          lineas: m.lineas,
        }),
      );
      pedido.actualizadoEn = new Date();
      await this.pedidos.guardar(pedido);
    }
  }

  /** Solo un pedido APARTADO (sin despachar). Uno DESPACHADO ya tiene factura: se anularía (pendiente). */
  async cancelar(cmd: CancelarPedidoCommand): Promise<Pedido> {
    const pedido = await this.requerir(cmd.codigoOrden);
    const idMensaje = this.normalizarMensaje(cmd.idMensaje);
    if (pedido.mensajes.includes(idMensaje)) return pedido;
    this.exigirEstado(pedido, EstadoPedido.APARTADO, 'cancelar');
    if (pedido.ventas.length) {
      throw new ConflictError(
        `La orden ${pedido.codigoOrden} ya tiene factura(s) ${pedido.ventas.map((v) => v.numero).join(', ')}: termine de despacharla`,
      );
    }

    for (const m of this.porBodega(pedido.lineas, pedido.codigoOrden, (l) => l.cantidadApartada)) {
      await this.stock.liberar(m);
    }
    pedido.estado = EstadoPedido.CANCELADO;
    return this.guardar(pedido, idMensaje);
  }

  async registrarPago(cmd: PagarPedidoCommand): Promise<Pedido> {
    const pedido = await this.requerir(cmd.codigoOrden);
    const idMensaje = this.normalizarMensaje(cmd.idMensaje);
    if (pedido.mensajes.includes(idMensaje)) return pedido;
    this.exigirEstado(pedido, EstadoPedido.DESPACHADO, 'pagar');

    const referencia = textoObligatorio(cmd.referenciaPago, 'La referencia del pago', 100);
    for (const v of pedido.ventas) await this.ventas.marcarPagada(v.id, referencia);
    pedido.estado = EstadoPedido.PAGADO;
    pedido.referenciaPago = referencia;
    return this.guardar(pedido, idMensaje);
  }

  consultar(codigoOrden: string): Promise<Pedido> {
    return this.requerir(codigoOrden);
  }

  listar(estado?: EstadoPedido): Promise<Pedido[]> {
    return this.pedidos.listar(estado);
  }

  // --- reglas ---

  /**
   * Para cada código, la marca y la bodega: entre las que tienen todas las unidades en una misma
   * bodega, la más barata (y a igual precio, la de más unidades). Es la misma regla de la cotización.
   */
  private async elegir(lineas: LineaCodigoCommand[]): Promise<LineaPedido[]> {
    const elegidas: LineaPedido[] = [];
    for (const { codigoUniversal, cantidad } of lineas) {
      const candidatos = await this.repuestos.porCodigoUniversal(codigoUniversal);
      if (!candidatos.length) throw new NotFoundError(`La tienda no maneja el repuesto ${codigoUniversal}`);

      const opciones = (
        await Promise.all(
          candidatos.map(async (r) =>
            (await this.stock.disponiblePorBodega(r.id)).map((b) => ({ repuesto: r, ...b })),
          ),
        )
      ).flat();
      const alcanzan = opciones
        .filter((o) => o.disponible >= cantidad)
        .sort((a, b) => a.repuesto.precio - b.repuesto.precio || b.disponible - a.disponible);
      if (!alcanzan.length) {
        const maximo = Math.max(0, ...opciones.map((o) => o.disponible));
        throw new ConflictError(
          `No hay ${cantidad} unidad(es) de ${codigoUniversal} en una misma bodega (como máximo hay ${maximo})`,
        );
      }
      const { repuesto, bodega } = alcanzan[0];
      elegidas.push({
        codigoUniversal,
        repuestoId: repuesto.id,
        sku: repuesto.sku,
        nombre: repuesto.nombre,
        bodega,
        precioUnitario: repuesto.precio,
        cantidadApartada: cantidad,
        cantidadEntregada: 0,
      });
    }
    return elegidas;
  }

  private validarLineas(lineas: LineaCodigoCommand[], minimaCantidad: 0 | 1): LineaCodigoCommand[] {
    if (minimaCantidad === 1 && !lineas?.length) throw new ValidationDomainError('El pedido debe tener al menos un repuesto');
    if ((lineas?.length ?? 0) > MAX_LINEAS) throw new ValidationDomainError(`Máximo ${MAX_LINEAS} repuestos por pedido`);
    const vistos = new Set<string>();
    return (lineas ?? []).map((l) => {
      const codigo = textoObligatorio(l.codigoUniversal, 'El código del repuesto', 50).toUpperCase();
      if (vistos.has(codigo)) throw new ValidationDomainError(`El repuesto ${codigo} está repetido`);
      vistos.add(codigo);
      if (!Number.isInteger(l.cantidad) || l.cantidad < minimaCantidad) {
        throw new ValidationDomainError(
          `La cantidad de ${codigo} debe ser un entero ${minimaCantidad ? 'mayor que 0' : 'mayor o igual a 0'}`,
        );
      }
      return { codigoUniversal: codigo, cantidad: l.cantidad };
    });
  }

  /** Agrupa por bodega las líneas con cantidad mayor que 0 (cada grupo se mueve todo o nada). */
  private porBodega(lineas: LineaPedido[], referencia: string, cantidad: (l: LineaPedido) => number): MovimientoDePedido[] {
    const grupos = new Map<string, MovimientoDePedido>();
    for (const l of lineas) {
      const n = cantidad(l);
      if (n <= 0) continue;
      const grupo = grupos.get(l.bodega) ?? { bodega: l.bodega, referencia, lineas: [] };
      grupo.lineas.push({ repuestoId: l.repuestoId, cantidad: n });
      grupos.set(l.bodega, grupo);
    }
    return [...grupos.values()];
  }

  private exigirEstado(pedido: Pedido, estado: EstadoPedido, accion: string): void {
    if (pedido.estado !== estado) {
      throw new ConflictError(`El pedido de la orden ${pedido.codigoOrden} está ${pedido.estado}: no se puede ${accion}`);
    }
  }

  private async requerir(codigoOrden: string): Promise<Pedido> {
    const codigo = this.normalizarOrden(codigoOrden);
    const pedido = await this.pedidos.buscarPorCodigoOrden(codigo);
    if (!pedido) throw new NotFoundError(`No hay un pedido para la orden ${codigo}`);
    return pedido;
  }

  private async guardar(pedido: Pedido, idMensaje: string): Promise<Pedido> {
    pedido.mensajes.push(idMensaje);
    pedido.actualizadoEn = new Date();
    await this.pedidos.guardar(pedido);
    return pedido;
  }

  private normalizarOrden(codigo: string): string {
    return textoObligatorio(codigo, 'El código de la orden', 50).toUpperCase();
  }

  private normalizarMensaje(idMensaje: string): string {
    return textoObligatorio(idMensaje, 'El id_mensaje', 120);
  }

  private async liberarSinFallar(movimientos: MovimientoDePedido[]): Promise<void> {
    for (const m of movimientos) {
      try {
        await this.stock.liberar(m);
      } catch (error) {
        this.logger.error(
          `No se pudo liberar lo apartado para ${m.referencia} en ${m.bodega}: revisar a mano`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }
  }
}
