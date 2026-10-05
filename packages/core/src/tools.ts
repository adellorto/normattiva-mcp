import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ricercaAggiornati } from "./api.js";
import { ActDiscovery } from "./discovery.js";
import { ActTraversal } from "./traversal.js";
import { registerDiscoveryTools } from "./discovery-tools.js";
import { registerTraversalTools } from "./traversal-tools.js";
import { configuredSigningKey } from "./reference-trust.js";
import { runTool } from "./execution.js";
import { jsonContent } from "./serialization.js";
import type { ToolContext } from "./context.js";
import { publicationSchema } from "./contracts.js";
import { OperationError } from "./errors.js";

const updatedActSchema = z.object({
  dataGU: publicationSchema.shape.data_gu,
  codiceRedazionale: publicationSchema.shape.codice_redazionale,
  descrizioneAtto: z.string().optional(), titoloAtto: z.string().optional(),
  dataUltimaModifica: z.string().optional(), ultimiAttiModificanti: z.string().optional(),
});
const updatesSchema = z.object({
  numeroAttiTrovati: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  listaAtti: z.array(updatedActSchema),
}).refine(data => data.numeroAttiTrovati === data.listaAtti.length);

/** One public registration shared by the stdio and HTTP servers. */
export function registerTools(server: McpServer, context: ToolContext = {}): void {
  const signingKey = context.signingKey ?? configuredSigningKey();
  const finder = new ActDiscovery({ signingKey, upstream: context.upstream });
  const reader = new ActTraversal({ signingKey, upstream: context.upstream });
  registerDiscoveryTools(server, finder, context);
  registerTraversalTools(server, reader, context);
  server.registerTool("recent_updates", {
    title: "Acts whose consolidated text was amended",
    description: "List acts whose consolidated text was amended in an inclusive date window of at most twelve months. For new Gazette publications use find_acts with an explicit publication window. These metadata do not establish what changed; read content before describing amendments.",
    inputSchema: z.object({
      data_inizio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      data_fine: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }).strict(),
  }, async (args, extra) => runTool("direct", extra.signal, context, args, async () => {
    const parsed = updatesSchema.safeParse(await ricercaAggiornati({
      dataInizioAggiornamento: `${args.data_inizio}T00:00:00.000Z`,
      dataFineAggiornamento: `${args.data_fine}T23:59:59.999Z`,
    }));
    if (!parsed.success) throw new OperationError({ category: "upstream_failure", code: "malformed_upstream_response",
      message: "Normattiva returned inconsistent updates metadata or publication identities.", retryability: false,
      provider: "normattiva", operation: "recent_updates" });
    const data = parsed.data;
    return jsonContent({
      numero_atti: data.numeroAttiTrovati,
      atti: data.listaAtti.map(a => ({
        descrizione: a.descrizioneAtto,
        titolo: a.titoloAtto,
        act_locator: reader.actLocator({ data_gu: a.dataGU, codice_redazionale: a.codiceRedazionale }),
        data_ultima_modifica: a.dataUltimaModifica,
        ultimi_atti_modificanti: a.ultimiAttiModificanti?.trim().split(/\s+/).filter(Boolean) ?? [],
      })),
    });
  }));
}
