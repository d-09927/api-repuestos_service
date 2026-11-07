import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BitacoraService } from './application/bitacora.service';
import { LlamadaMcpRepositoryPort } from './domain/ports/llamada-mcp.repository.port';
import { LlamadaMcpTypeOrmRepository } from './infrastructure/adapters/llamada-mcp.typeorm.repository';
import { LlamadaMcpOrmEntity } from './infrastructure/entities/llamada-mcp.orm-entity';
import { BitacoraController } from './infrastructure/http/bitacora.controller';

@Module({
  imports: [TypeOrmModule.forFeature([LlamadaMcpOrmEntity])],
  controllers: [BitacoraController],
  providers: [
    BitacoraService,
    { provide: LlamadaMcpRepositoryPort, useClass: LlamadaMcpTypeOrmRepository },
  ],
  exports: [BitacoraService],
})
export class BitacoraModule {}
