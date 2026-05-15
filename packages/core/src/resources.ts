import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  getDenominazioni,
  getClassiProvvedimento,
  getCollezioniPredefinite,
  getRicerchePredefinite,
} from "./api.js";
import type { ToolContext } from "./context.js";

function jsonResource(uri: URL, data: unknown) {
  return {
    contents: [
      {
        uri: uri.href,
        mimeType: "application/json",
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

export function registerResources(server: McpServer, _ctx: ToolContext): void {
  server.registerResource(
    "denominazioni",
    "normattiva://tipologiche/denominazioni",
    {
      title: "Codici denominazione atto",
      description:
        "List of valid act-type codes accepted by Normattiva (label = code, value = full Italian description). Use the value (e.g. 'LEGGE') for the denominazione parameter of search_acts.",
      mimeType: "application/json",
    },
    async (uri) => jsonResource(uri, await getDenominazioni()),
  );

  server.registerResource(
    "classi-provvedimento",
    "normattiva://tipologiche/classi-provvedimento",
    {
      title: "Classi di provvedimento (vigenza)",
      description:
        "Vigenza class codes: 1 = atto senza aggiornamenti, 2 = aggiornato, 3 = abrogato. Use the label as the classe parameter of search_acts.",
      mimeType: "application/json",
    },
    async (uri) => jsonResource(uri, await getClassiProvvedimento()),
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
    async (uri) => jsonResource(uri, await getCollezioniPredefinite()),
  );

  server.registerResource(
    "ricerche-predefinite",
    "normattiva://ricerche-predefinite",
    {
      title: "Ricerche predefinite Normattiva",
      description:
        "Predefined searches with their preset filters (date ranges, classe, etc.).",
      mimeType: "application/json",
    },
    async (uri) => jsonResource(uri, await getRicerchePredefinite()),
  );
}
