import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { AGENTE_PROPIO, CABECERA_LLAMANTE } from '../../mcp/llamante';
import type { Herramienta, LlamadaHerramienta } from '../../ia/ia.service';

export interface SesionMcp{
    herramientas: Herramienta[];
    ejecutar(llamada: LlamadaHerramienta): Promise<string>;
    cerrar(): Promise<void>;
}

@Injectable()
export class McpClienteService {
    private readonly url:string;
    private readonly token: string;

    constructor(config: ConfigService){
        this.url = config.get('AGENTE_MCP_URL', 'http://localhost:3000/mcp');
        this.token = config.get('AGENTE_MCP_TOKEN', '')
    }

    async abrir():Promise<SesionMcp>{
        const cliente = new Client({name:'agente-repuestos', version: '1.0.0'});
        await cliente.connect(
            new StreamableHTTPClientTransport(new URL(this.url), {
                requestInit: { headers: { Authorization: `Bearer ${this.token}`, [CABECERA_LLAMANTE]: AGENTE_PROPIO }},
            }),
        )

        const {tools} = await cliente.listTools();
        const herramientas: Herramienta[] = tools.map((t) => ({
            type: 'function',
            function: { name:t.name, description:t.description, parameters:t.inputSchema},
        }));

        const ejecutar = async(llamada: LlamadaHerramienta): Promise<string>=>{
            let argumentos: Record<string,unknown>;
            try {
                argumentos= JSON.parse(llamada.function.arguments || '{}');
            } catch  {
                return 'ERROR: los argumentos no son un JSON válido. Corríjalos y vuelva a intentar.';
            }

            try{
                const r = await cliente.callTool({name: llamada.function.name, arguments:argumentos});
                const texto = r.content.map((c)=> (c.type === 'text' ? c.text : '')).join('\n');
                return r.isError ? `ERROR: ${texto}` : texto;
            }catch (error){
                return `ERROR: ${(error as Error).message}`;
            }
        }

        return {herramientas, ejecutar, cerrar:()=>cliente.close()};
    }
}