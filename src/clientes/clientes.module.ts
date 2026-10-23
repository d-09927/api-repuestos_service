import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientesService } from './application/clientes.service';
import { ClienteRepositoryPort } from './domain/ports/cliente.repository.port';
import { ClienteTypeOrmRepository } from './infrastructure/adapters/cliente.typeorm.repository';
import { ClienteOrmEntity } from './infrastructure/entities/cliente.orm-entity';
import { ClientesController } from './infrastructure/http/clientes.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ClienteOrmEntity])],
  controllers: [ClientesController],
  providers: [
    ClientesService,
    { provide: ClienteRepositoryPort, useClass: ClienteTypeOrmRepository },
  ],
  // Ventas usa el service (a través de su propio puerto), nunca la tabla.
  exports: [ClientesService],
})
export class ClientesModule {}
