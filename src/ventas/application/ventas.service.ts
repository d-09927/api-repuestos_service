import { randomUUID } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { sumar } from '../../common/dinero';
import { ConflictError, NotFoundError } from '../../common/domain-error';
import { finDelDia, inicioDelDia } from '../../common/fechas';
import { PaginaResultado } from '../../common/paginacion';
import { UnidadDeTrabajoPort } from '../../common/unidad-de-trabajo/unidad-de-trabajo.port';
import { textoObligatorio, textoOpcional } from '../../common/validaciones';
import { Venta } from '../domain/entities/venta.entity';
import { EstadoVenta } from '../domain/enums/estado-venta.enum';
import { ClienteServicePort } from '../domain/ports/cliente.service.port';
import { RepuestoServicePort } from '../domain/ports/repuesto.service.port';
import { MovimientoDeVenta, StockServicePort } from '../domain/ports/stock.service.port';
import { VentaDetalleServicePort } from '../domain/ports/venta-detalle.service.port';
import { VentaRepositoryPort } from '../domain/ports/venta.repository.port';
import { CreateVentaCommand, OpcionesVenta } from './dto/create-venta.command';
import { ListVentasQuery } from './dto/list-ventas.query';
import { VentaConDetalles } from './dto/venta-con-detalles.result';

const BODEGA_POR_DEFECTO = 'PRINCIPAL';

/** Casos de uso y reglas de ventas. Una venta registrada no se edita ni se borra. */
@Injectable()
export class VentasService {
  private readonly logger = new Logger(VentasService.name);

  constructor(
    private readonly ventas: VentaRepositoryPort,
    private readonly detalles: VentaDetalleServicePort,
    private readonly clientes: ClienteServicePort,
    private readonly repuestos: RepuestoServicePort,
    private readonly stock: StockServicePort,
    private readonly unidadDeTrabajo: UnidadDeTrabajoPort,
  ) {}

  async registrar(cmd: CreateVentaCommand, opciones: OpcionesVenta = {}): Promise<VentaConDetalles> {
    if (cmd.clienteId) await this.clientes.verificarClienteActivo(cmd.clienteId);
    const repuestos = await this.repuestos.obtenerActivos(cmd.lineas.map((l) => l.repuestoId));
    const porId = new Map(repuestos.map((r) => [r.id, r]));

    const id = randomUUID();
    const detalles = this.detalles.construir(
      cmd.lineas.map((l) => ({
        ventaId: id,
        repuestoId: l.repuestoId,
        sku: porId.get(l.repuestoId)!.sku,
        nombre: porId.get(l.repuestoId)!.nombre,
        cantidad: l.cantidad,
        precioUnitario: porId.get(l.repuestoId)!.precio,
      })),
    );
    const ahora = new Date();
    const venta = new Venta({
      id,
      numero: this.numeroDesde(await this.ventas.siguienteConsecutivo()),
      clienteId: cmd.clienteId ?? null,
      bodega: textoObligatorio(cmd.bodega ?? BODEGA_POR_DEFECTO, 'La bodega', 50).toUpperCase(),
      observaciones: textoOpcional(cmd.observaciones, 'Las observaciones', 500),
      total: sumar(detalles.map((d) => d.subtotal)),
      estado: opciones.pendienteDePago ? EstadoVenta.PENDIENTE_PAGO : EstadoVenta.PAGADA,
      referenciaPago: null,
      pagadaEn: opciones.pendienteDePago ? null : ahora,
      fecha: ahora,
      creadoEn: ahora,
    });

    // Primero el stock (todo o nada: si una línea no alcanza se rechaza la venta completa)
    // y luego el registro de la venta con sus líneas (otra transacción).
    const movimiento: MovimientoDeVenta = {
      bodega: venta.bodega,
      referencia: venta.numero,
      lineas: detalles.map((d) => ({ repuestoId: d.repuestoId, cantidad: d.cantidad })),
      desdeReserva: opciones.desdeReserva,
    };
    await this.stock.descontarMercancia(movimiento);

    try {
      await this.unidadDeTrabajo.ejecutar(async () => {
        await this.ventas.guardar(venta);
        await this.detalles.guardar(detalles);
      });
    } catch (error) {
      await this.revertirDescuento(movimiento);
      throw error;
    }
    return { venta, detalles };
  }

  async listar(query: ListVentasQuery): Promise<PaginaResultado<VentaConDetalles>> {
    const pagina = await this.ventas.listar({
      clienteId: query.clienteId,
      desde: query.desde ? inicioDelDia(query.desde) : undefined,
      hasta: query.hasta ? finDelDia(query.hasta) : undefined,
      pagina: query.pagina,
      limite: query.limite,
    });
    const detalles = await this.detalles.listarPorVentas(pagina.items.map((v) => v.id));
    return {
      ...pagina,
      items: pagina.items.map((venta) => ({
        venta,
        detalles: detalles.filter((d) => d.ventaId === venta.id),
      })),
    };
  }

  async obtener(id: string): Promise<VentaConDetalles> {
    const venta = await this.ventas.buscarPorId(id);
    if (!venta) throw new NotFoundError(`No existe la venta ${id}`);
    return { venta, detalles: await this.detalles.listarPorVentas([id]) };
  }

  /** Una venta por cobrar (de un pedido) pasa a pagada cuando el comprador confirma el pago. */
  async marcarPagada(id: string, referenciaPago: string): Promise<Venta> {
    const { venta } = await this.obtener(id);
    if (venta.estado !== EstadoVenta.PENDIENTE_PAGO) {
      throw new ConflictError(`La venta ${venta.numero} ya está pagada`);
    }
    venta.estado = EstadoVenta.PAGADA;
    venta.referenciaPago = textoObligatorio(referenciaPago, 'La referencia del pago', 100);
    venta.pagadaEn = new Date();
    await this.ventas.guardar(venta);
    return venta;
  }

  /** V-000001, V-000002... a partir del consecutivo que entrega la base de datos. */
  private numeroDesde(consecutivo: number): string {
    return `V-${String(consecutivo).padStart(6, '0')}`;
  }

  /** Si la venta no se pudo guardar, el stock que ya salió se devuelve. */
  private async revertirDescuento(movimiento: MovimientoDeVenta): Promise<void> {
    try {
      await this.stock.revertirDescuento(movimiento);
    } catch (error) {
      this.logger.error(
        `La venta ${movimiento.referencia} no se guardó y tampoco se pudo devolver su stock: revisar a mano`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
