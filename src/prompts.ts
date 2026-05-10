import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerPrompts(server: McpServer): void {
  server.registerPrompt(
    "ricerca-articolo",
    {
      title: "Cerca un articolo per argomento",
      description:
        "Cerca atti normativi italiani su un argomento e legge gli articoli più rilevanti.",
      argsSchema: {
        argomento: z.string().describe("Argomento di interesse, es. 'protezione dei dati personali'."),
      },
    },
    ({ argomento }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text:
              `Voglio capire la normativa italiana su: ${argomento}.\n\n` +
              `Procedi così:\n` +
              `1. Usa lo strumento search_acts per individuare gli atti normativi più rilevanti sull'argomento.\n` +
              `2. Identifica l'atto (o gli atti) più pertinenti dai risultati.\n` +
              `3. Usa read_article per leggere gli articoli più probabilmente rilevanti — fino a circa 10 articoli, scelti in base ai titoli/descrizioni.\n` +
              `4. Fornisci una sintesi chiara con i riferimenti normativi (atto, articolo) per ogni punto.`,
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "monitoraggio-modifiche",
    {
      title: "Monitora modifiche normative recenti",
      description:
        "Recupera gli atti normativi italiani modificati negli ultimi N giorni e ne fornisce un riepilogo.",
      argsSchema: {
        giorni: z
          .string()
          .regex(/^\d+$/, "Numero di giorni come stringa intera")
          .default("7")
          .describe("Quanti giorni indietro guardare (default 7)."),
      },
    },
    ({ giorni }) => {
      const n = Number.parseInt(giorni ?? "7", 10);
      const oggi = new Date();
      const inizio = new Date(oggi.getTime() - n * 24 * 60 * 60 * 1000);
      const fmt = (d: Date) => d.toISOString().slice(0, 10);
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text:
                `Recupera con recent_updates gli atti normativi italiani modificati ` +
                `tra il ${fmt(inizio)} e il ${fmt(oggi)}. ` +
                `Raggruppa i risultati per tipologia di atto e fornisci un riepilogo ` +
                `delle modifiche più rilevanti, evidenziando gli atti modificanti principali.`,
            },
          },
        ],
      };
    },
  );
}
