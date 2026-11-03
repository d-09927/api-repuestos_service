import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientesService } from '../../../clientes/application/clientes.service';
import { TipoDocumento } from '../../../clientes/domain/enums/tipo-documento.enum';
import { ClienteServicePort } from '../../domain/ports/cliente.service.port';

/**
 * ADAPTADOR "local": el comprador de los repuestos de las órdenes de taller es facturación
 * (FACTURACION_NIT, FACTURACION_NOMBRE). Si no está registrado como cliente, se crea.
 */
@Injectable()
export class ClienteLocalAdapter extends ClienteServicePort {
  private id?: string;

  constructor(
    private readonly clientes: ClientesService,
    private readonly config: ConfigService,
  ) {
    super();
  }

  async comprador(): Promise<string> {
    if (this.id) return this.id;
    const nit = this.config.get<string>('FACTURACION_NIT', '900000000-0').trim().toUpperCase();
    const encontrados = await this.clientes.listar({ texto: nit, incluirInactivos: true, pagina: 1, limite: 20 });
    const existente = encontrados.items.find((c) => c.tipoDocumento === TipoDocumento.NIT && c.documento === nit);
    const cliente =
      existente ??
      (await this.clientes.crear({
        tipoDocumento: TipoDocumento.NIT,
        documento: nit,
        nombre: this.config.get<string>('FACTURACION_NOMBRE', 'Facturación (Ventas y contabilidad)'),
      }));
    this.id = cliente.id;
    return cliente.id;
  }
}
