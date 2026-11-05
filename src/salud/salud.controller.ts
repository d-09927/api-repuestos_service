import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

/** Sin token: los otros equipos revisan con esto que la API responde en la red. */
@ApiTags('salud')
@Controller('salud')
export class SaludController {
  @Get()
  salud() {
    return { estado: 'ok' };
  }
}
