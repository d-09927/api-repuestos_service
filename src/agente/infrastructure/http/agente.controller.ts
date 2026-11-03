import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AgenteService } from '../../application/agente.service';
import { MensajeDto } from './dto/mensaje.dto';

/** Solo HTTP: recibe el mensaje, delega en el agente y responde. */
@ApiTags('agente')
@Controller('agente')
export class AgenteController {
  constructor(private readonly agente: AgenteService) {}

  @Post('mensajes')
  @HttpCode(HttpStatus.OK)
  responder(@Body() dto: MensajeDto) {
    return this.agente.responder(dto.texto, dto.conversacionId);
  }
}
