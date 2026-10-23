import { Global, Module } from '@nestjs/common';
import { UnidadDeTrabajoPort } from './unidad-de-trabajo.port';
import { UnidadDeTrabajoTypeOrm } from './unidad-de-trabajo.typeorm';

@Global()
@Module({
  providers: [{ provide: UnidadDeTrabajoPort, useClass: UnidadDeTrabajoTypeOrm }],
  exports: [UnidadDeTrabajoPort],
})
export class UnidadDeTrabajoModule {}
