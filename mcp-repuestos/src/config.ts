import { z } from 'zod';

const EnvSchema = z.object({
  REPUESTOS_API_URL: z.string().url().default('http://localhost:3000/api'),
  MCP_TRANSPORT: z.enum(['stdio', 'http']).default('stdio'),
  MCP_PORT: z.coerce.number().int().min(1).max(65535).default(3100),
  MCP_TOKEN: z.string().optional(),
  MCP_PERMITIR_ESCRITURA: z
    .string()
    .optional()
    .transform((v) => v === 'true' || v === '1'),
});

const entorno = EnvSchema.safeParse(process.env);
if (!entorno.success) {
  // stderr: en stdio, stdout es el canal del protocolo y no se puede ensuciar.
  console.error('Configuración inválida:', JSON.stringify(entorno.error.flatten().fieldErrors));
  process.exit(1);
}

export const config = {
  apiUrl: entorno.data.REPUESTOS_API_URL.replace(/\/+$/, ''),
  transporte: entorno.data.MCP_TRANSPORT,
  puerto: entorno.data.MCP_PORT,
  token: entorno.data.MCP_TOKEN || undefined,
  permitirEscritura: entorno.data.MCP_PERMITIR_ESCRITURA,
};
