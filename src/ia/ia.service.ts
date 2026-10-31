import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export interface LlamadaHerramienta {
    id:string;
    type:'function';
    function:{name: string, arguments: string};
}

export type Mensaje = 
    | { role: 'system' | 'user'; content:string}
    | { role: 'assistant'; content:string | null; tool_calls?:  LlamadaHerramienta[]}
    | { role: 'tool'; tool_call_id:string; content:string}


export interface Herramienta {
  type: 'function';
  function: { name: string; description?: string; parameters: Record<string, unknown> };
}

export interface RespuestaModelo {
    texto:string;
    llamadas: LlamadaHerramienta[];
}

@Injectable()
export class IaService{
    private readonly url:string;
    private readonly llave:string;
    readonly modelo: string;

    constructor(
        config:ConfigService
    ){
        this.url = config.get<string>('IA_URL', 'http://localhost:11434/v1');
        this.llave = config.get<string>('IA_KEY', 'ollama');
        this.modelo = config.get<string>('IA_MODELO', 'qwen3.5:4b');
    }

    async completar (mensajes: Mensaje[], herramientas:Herramienta[]=[]): Promise<RespuestaModelo> {
        let respuesta: Response;

        try {
            respuesta = await fetch(`${this.url}/chat/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.llave}` },
                body: JSON.stringify({
                    model: this.modelo,
                    messages:mensajes,
                    tools: herramientas.length ? herramientas : undefined,
                    temperature: 0.2,
                }),

                signal: AbortSignal.timeout(120_000),
            })
        }catch{
            throw new ServiceUnavailableException(`No hay conexion con el modelo en ${this.url}`)
        }
        if(!respuesta.ok){
            throw new ServiceUnavailableException(`El modelo respondió HTTP ${respuesta.status}`);
        }

        const datos = await respuesta.json();
         const eleccion = datos.choices?.[0];
    // "length": el modelo se quedó sin espacio de contexto y la respuesta llegó cortada.
    if (eleccion?.finish_reason === 'length') {
      throw new ServiceUnavailableException(
        'El modelo se quedó sin contexto (finish_reason=length): aumente num_ctx del modelo.',
      );
    }
        const mensaje = eleccion?.message ?? {};
        return { texto: mensaje.content ?? '', llamadas:mensaje.tool_calls ?? []}
    }
}