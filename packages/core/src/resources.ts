import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  getDenominazioni,
  getClassiProvvedimento,
  getCollezioniPredefinite,
  getRicerchePredefinite,
} from "./api.js";
import type { ToolContext } from "./context.js";
import { runResource } from "./execution.js";
import { assertResponseSize } from "./serialization.js";

function jsonResource(uri: URL, data: unknown) {
  const result = {
    contents: [
      {
        uri: uri.href,
        mimeType: "application/json",
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
  assertResponseSize(result);
  return result;
}

export function registerResources(server: McpServer, _ctx: ToolContext): void {
  server.registerResource(
    "denominazioni",
    "normattiva://tipologiche/denominazioni",
    {
      title: "Codici denominazione atto",
      description:
        "Official act-type catalog (label = code, value = Italian name). Reference metadata; find_acts accepts the user's request directly and needs no catalog lookup.",
      mimeType: "application/json",
    },
    async (uri, extra) => runResource(extra.signal, _ctx, async () => jsonResource(uri, await getDenominazioni())),
  );

  server.registerResource(
    "classi-provvedimento",
    "normattiva://tipologiche/classi-provvedimento",
    {
      title: "Classi di provvedimento (vigenza)",
      description:
        "Official version-class catalog: 1 = without amendments, 2 = amended, 3 = repealed. For status research preserve the constraint in the find_acts request; this catalog is not evidence of any selected act's currentness.",
      mimeType: "application/json",
    },
    async (uri, extra) => runResource(extra.signal, _ctx, async () => jsonResource(uri, await getClassiProvvedimento())),
  );

  server.registerResource(
    "collezioni-predefinite",
    "normattiva://collezioni-predefinite",
    {
      title: "Collezioni preconfezionate Normattiva",
      description:
        "Predefined collections of acts available on Normattiva, with the number of acts in each.",
      mimeType: "application/json",
    },
    async (uri, extra) => runResource(extra.signal, _ctx, async () => jsonResource(uri, await getCollezioniPredefinite())),
  );

  server.registerResource(
    "ricerche-predefinite",
    "normattiva://ricerche-predefinite",
    {
      title: "Ricerche predefinite Normattiva",
      description:
        "Official predefined searches and their upstream filters, for reference. Express relevant constraints in the find_acts request; these records are not tool-call arguments.",
      mimeType: "application/json",
    },
    async (uri, extra) => runResource(extra.signal, _ctx, async () => jsonResource(uri, await getRicerchePredefinite())),
  );
}
