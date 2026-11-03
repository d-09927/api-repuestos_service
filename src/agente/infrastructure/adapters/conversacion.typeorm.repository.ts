import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { ConflictError } from '../../../common/domain-error';
import { MensajeConversacion, RolMensaje } from '../../domain/entities/mensaje-conversacion.entity';
import { ConversacionRepositoryPort } from '../../domain/ports/conversacion.repository.port';
import { MensajeConversacionOrmEntity } from '../entities/mensaje-conversacion.orm-entity';

/** ADAPTADOR de salida: implementa ConversacionRepositoryPort con TypeORM + Postgres. */
@Injectable()
export class ConversacionTypeOrmRepository extends ConversacionRepositoryPort {
  constructor(
    @InjectRepository(MensajeConversacionOrmEntity)
    private readonly orm: Repository<MensajeConversacionOrmEntity>,
  ) {
    super();
  }

  existe(conversacionId: string): Promise<boolean> {
    return this.orm.exists({ where: { conversacionId } });
  }

  async ultimos(conversacionId: string, limite: number): Promise<MensajeConversacion[]> {
    const filas = await this.orm.find({ where: { conversacionId }, order: { orden: 'DESC' }, take: limite });
    return filas.reverse().map((f) => this.aDominio(f));
  }

  async guardar(mensajes: MensajeConversacion[]): Promise<void> {
    try {
      // save con un arreglo corre en una sola transacción: se guardan todos o ninguno.
      await this.orm.save(mensajes.map((m) => Object.assign(new MensajeConversacionOrmEntity(), { ...m })));
    } catch (error) {
      if (error instanceof QueryFailedError && (error.driverError as { code?: string })?.code === '23505') {
        throw new ConflictError('La conversación recibió otro mensaje al mismo tiempo; espere la respuesta y reintente');
      }
      throw error;
    }
  }

  private aDominio(f: MensajeConversacionOrmEntity): MensajeConversacion {
    return new MensajeConversacion({
      id: f.id,
      conversacionId: f.conversacionId,
      orden: f.orden,
      rol: f.rol as RolMensaje,
      contenido: f.contenido,
      llamadas: f.llamadas,
      llamadaId: f.llamadaId,
      creadoEn: f.creadoEn,
    });
  }
}
