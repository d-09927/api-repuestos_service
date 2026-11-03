import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IaModule } from '../ia/ia.module';
import { AgenteService } from './application/agente.service';
import { McpClienteService } from './application/mcp-cliente.service';
import { ConversacionRepositoryPort } from './domain/ports/conversacion.repository.port';
import { ConversacionTypeOrmRepository } from './infrastructure/adapters/conversacion.typeorm.repository';
import { MensajeConversacionOrmEntity } from './infrastructure/entities/mensaje-conversacion.orm-entity';
import { AgenteController } from './infrastructure/http/agente.controller';

// El agente no importa los módulos de negocio: usa las herramientas por el MCP (HTTP).
// Su única tabla es la de la conversación (agente_mensajes).
@Module({
  imports: [IaModule, TypeOrmModule.forFeature([MensajeConversacionOrmEntity])],
  controllers: [AgenteController],
  providers: [
    AgenteService,
    McpClienteService,
    { provide: ConversacionRepositoryPort, useClass: ConversacionTypeOrmRepository },
  ],
  // El MCP lo usa en hablar_con_repuestos: los agentes de otros sectores le hablan a este agente.
  exports: [AgenteService],
})
export class AgenteModule {}
