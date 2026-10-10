import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ToolContext } from "./context.js";

export function registerPrompts(server: McpServer, _ctx: ToolContext): void {
  server.registerPrompt("ricerca-articolo", {
    title: "Cerca un articolo per argomento",
    description: "Ricerca limitata: individua atti e intestazioni effettive, legge gli articoli selezionati e dichiara la copertura.",
    argsSchema: { argomento: z.string().trim().min(1).max(4096).describe("Argomento o richiesta normativa, con eventuali date e vincoli.") },
  }, ({ argomento }) => ({ messages: [{ role: "user", content: { type: "text", text:
    `Voglio capire la normativa italiana su: ${argomento}.\n\n` +
    `1. Usa find_acts preservando la richiesta e i suoi vincoli. Se occorre continua con continue_acts e il cursor letterale; seleziona al massimo 3 atti pertinenti senza indovinare tra candidati incerti.\n` +
    `2. Per ciascun atto scelto usa list_articles con act_locator e una data snapshot_date coerente; scegli dalle intestazioni effettive, non dai numeri immaginati a partire dal titolo dell'atto.\n` +
    `3. Leggi con read_article e gli article_locator selezionati al massimo 10 articoli complessivi. Riprendi pagine e testi con il cursor restituito, senza ricostruirlo o mescolarlo ad altri riferimenti; per tabelle e allegati leggibili usa read_act.\n` +
    `4. Cita e sintetizza solo contenuti effettivamente letti. Dichiara data, atti e articoli esaminati, copertura incompleta, candidati incerti e allegati non letti. Pagine vuote, unresolved ed errori non provano assenza; complete non garantisce ricerca giuridica esaustiva.\n` +
    `5. Se l'utente richiede una ricerca esaustiva, segui tutte le continuazioni necessarie mantenendo i limiti di ogni chiamata e dichiara comunque i limiti della fonte e della copertura.`,
  } }] }));

  server.registerPrompt("monitoraggio-modifiche", {
    title: "Monitora modifiche al testo consolidato di atti esistenti",
    description: "Elenca atti con testo consolidato modificato negli ultimi N giorni. Per nuove pubblicazioni usa find_acts con date esplicite di pubblicazione.",
    argsSchema: { giorni: z.string().regex(/^\d+$/).refine(value => Number(value) >= 1 && Number(value) <= 365,
      "Usa un numero di giorni tra 1 e 365").default("7").describe("Giorni precedenti (1–365, default 7).") },
  }, ({ giorni }) => {
    const today = new Date();
    const start = new Date(today.getTime() - Number(giorni ?? "7") * 86_400_000);
    const fmt = (date: Date) => date.toISOString().slice(0, 10);
    return { messages: [{ role: "user", content: { type: "text", text:
      `Usa recent_updates per gli atti il cui testo consolidato è stato modificato tra ${fmt(start)} e ${fmt(today)}. ` +
      `Sono modifiche di atti esistenti, non nuove pubblicazioni in Gazzetta Ufficiale: per queste usa find_acts con una richiesta che espliciti l'intervallo di pubblicazione. ` +
      `Raggruppa i metadati per tipologia. Non dedurre il contenuto delle modifiche dai soli metadati: per descriverlo leggi i testi pertinenti usando act_locator e date esplicite, citando solo quanto letto. ` +
      `Dichiara la copertura e i limiti; unresolved ed errori non provano assenza.`,
    } }] };
  });
}
