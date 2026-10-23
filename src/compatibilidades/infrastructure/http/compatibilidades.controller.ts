import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CompatibilidadesService } from '../../application/compatibilidades.service';
import { toCompatibilidadResponse } from './compatibilidad.response';

/** Solo HTTP. Las compatibilidades se cambian desde el repuesto (PATCH /repuestos/:id). */
@ApiTags('compatibilidades')
@Controller('repuestos/:repuestoId/compatibilidades')
export class CompatibilidadesController {
  constructor(private readonly service: CompatibilidadesService) {}

  @Get()
  async findAll(@Param('repuestoId', ParseUUIDPipe) repuestoId: string) {
    const lista = await this.service.listarPorRepuesto(repuestoId);
    return lista.map(toCompatibilidadResponse);
  }
}
