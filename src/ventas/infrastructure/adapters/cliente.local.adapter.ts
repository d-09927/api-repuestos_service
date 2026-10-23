import { Injectable } from '@nestjs/common';
import { ClientesService } from '../../../clientes/application/clientes.service';
import { ClienteServicePort } from '../../domain/ports/cliente.service.port';

/** ADAPTADOR "local": le pregunta al service del módulo de clientes (mismo proceso). */
@Injectable()
export class ClienteLocalAdapter extends ClienteServicePort {
  constructor(private readonly clientes: ClientesService) {
    super();
  }

  async verificarClienteActivo(clienteId: string): Promise<void> {
    await this.clientes.verificarActivo(clienteId);
  }
}
