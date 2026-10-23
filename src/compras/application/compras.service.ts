import { randomUUID } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { sumar } from '../../common/dinero';
import { NotFoundError } from '../../common/domain-error';
import { finDelDia, inicioDelDia } from '../../common/fechas';
import { PaginaResultado } from '../../common/paginacion';
import { UnidadDeTrabajoPort } from '../../common/unidad-de-trabajo/unidad-de-trabajo.port';
import { textoObligatorio, textoOpcional } from '../../common/validaciones';
import { Compra } from '../domain/entities/compra.entity';
import { CompraDetalleServicePort } from '../domain/ports/compra-detalle.service.port';
import { CompraRepositoryPort } from '../domain/ports/compra.repository.port';
import { ProveedorServicePort } from '../domain/ports/proveedor.service.port';
import { RepuestoServicePort } from '../domain/ports/repuesto.service.port';
import { MovimientoDeCompra, StockServicePort } from '../domain/ports/stock.service.port';
import { CompraConDetalles } from './dto/compra-con-detalles.result';
import { CreateCompraCommand } from './dto/create-compra.command';
import { ListComprasQuery } from './dto/list-compras.query';

const BODEGA_POR_DEFECTO = 'PRINCIPAL';

/** Casos de uso y reglas de compras. Una compra registrada no se edita ni se borra. */
@Injectable()
export class ComprasService {
  private readonly logger = new Logger(ComprasService.name);

  constructor(
    private readonly compras: CompraRepositoryPort,
    private readonly detalles: CompraDetalleServicePort,
    private readonly proveedores: ProveedorServicePort,
    private readonly repuestos: RepuestoServicePort,
    private readonly stock: StockServicePort,
    private readonly unidadDeTrabajo: UnidadDeTrabajoPort,
  ) {}

  async registrar(cmd: CreateCompraCommand): Promise<CompraConDetalles> {
    await this.proveedores.verificarProveedorActivo(cmd.proveedorId);
    const repuestos = await this.repuestos.obtenerActivos(cmd.lineas.map((l) => l.repuestoId));
    const porId = new Map(repuestos.map((r) => [r.id, r]));

    const id = randomUUID();
    const detalles = this.detalles.construir(
      cmd.lineas.map((l) => ({
        compraId: id,
        repuestoId: l.repuestoId,
        sku: porId.get(l.repuestoId)!.sku,
        nombre: porId.get(l.repuestoId)!.nombre,
        cantidad: l.cantidad,
        costoUnitario: l.costoUnitario,
      })),
    );
    const ahora = new Date();
    const compra = new Compra({
      id,
      numero: this.numeroDesde(await this.compras.siguienteConsecutivo()),
      proveedorId: cmd.proveedorId,
      bodega: textoObligatorio(cmd.bodega ?? BODEGA_POR_DEFECTO, 'La bodega', 50).toUpperCase(),
      numeroFacturaProveedor: textoOpcional(cmd.numeroFacturaProveedor, 'El número de factura', 60),
      observaciones: textoOpcional(cmd.observaciones, 'Las observaciones', 500),
      total: sumar(detalles.map((d) => d.subtotal)),
      fecha: ahora,
      creadoEn: ahora,
    });

    // Primero el stock (todo o nada) y luego el registro de la compra con sus líneas (otra transacción).
    const movimiento: MovimientoDeCompra = {
      bodega: compra.bodega,
      referencia: compra.numero,
      lineas: detalles.map((d) => ({ repuestoId: d.repuestoId, cantidad: d.cantidad })),
    };
    await this.stock.ingresarMercancia(movimiento);

    try {
      await this.unidadDeTrabajo.ejecutar(async () => {
        await this.compras.guardar(compra);
        await this.detalles.guardar(detalles);
      });
    } catch (error) {
      await this.revertirIngreso(movimiento);
      throw error;
    }
    return { compra, detalles };
  }

  async listar(query: ListComprasQuery): Promise<PaginaResultado<CompraConDetalles>> {
    const pagina = await this.compras.listar({
      proveedorId: query.proveedorId,
      desde: query.desde ? inicioDelDia(query.desde) : undefined,
      hasta: query.hasta ? finDelDia(query.hasta) : undefined,
      pagina: query.pagina,
      limite: query.limite,
    });
    const detalles = await this.detalles.listarPorCompras(pagina.items.map((c) => c.id));
    return {
      ...pagina,
      items: pagina.items.map((compra) => ({
        compra,
        detalles: detalles.filter((d) => d.compraId === compra.id),
      })),
    };
  }

  async obtener(id: string): Promise<CompraConDetalles> {
    const compra = await this.compras.buscarPorId(id);
    if (!compra) throw new NotFoundError(`No existe la compra ${id}`);
    return { compra, detalles: await this.detalles.listarPorCompras([id]) };
  }

  /** C-000001, C-000002... a partir del consecutivo que entrega la base de datos. */
  private numeroDesde(consecutivo: number): string {
    return `C-${String(consecutivo).padStart(6, '0')}`;
  }

  /** Si la compra no se pudo guardar, el stock que ya entró se devuelve. */
  private async revertirIngreso(movimiento: MovimientoDeCompra): Promise<void> {
    try {
      await this.stock.revertirIngreso(movimiento);
    } catch (error) {
      this.logger.error(
        `La compra ${movimiento.referencia} no se guardó y tampoco se pudo revertir su ingreso de stock: revisar a mano`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
