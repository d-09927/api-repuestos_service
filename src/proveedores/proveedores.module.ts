import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProveedoresService } from './application/proveedores.service';
import { ProveedorRepositoryPort } from './domain/ports/proveedor.repository.port';
import { ProveedorTypeOrmRepository } from './infrastructure/adapters/proveedor.typeorm.repository';
import { ProveedorOrmEntity } from './infrastructure/entities/proveedor.orm-entity';
import { ProveedoresController } from './infrastructure/http/proveedores.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ProveedorOrmEntity])],
  controllers: [ProveedoresController],
  providers: [
    ProveedoresService,
    { provide: ProveedorRepositoryPort, useClass: ProveedorTypeOrmRepository },
  ],
  // Compras usa el service (a través de su propio puerto), nunca la tabla.
  exports: [ProveedoresService],
})
export class ProveedoresModule {}
