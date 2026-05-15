import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import {
  ricercaAvanzata,
  dettaglioAtto,
  ricercaAggiornati,
} from "./api.js";
import { htmlToText } from "./html.js";
import type { RicercaAvanzataBody } from "./types.js";
import type { ToolContext } from "./context.js";

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use ISO date YYYY-MM-DD");

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function jsonContent(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

export function registerTools(server: McpServer, _ctx: ToolContext): void {
  server.registerTool(
    "search_acts",
    {
      title: "Search Italian legislation (Normattiva)",
      description:
        "Search Italian legislation on Normattiva by free text, title, act type, year/number, date range, or vigenza class. Returns metadata for each matching atto including codice_redazionale and data_gu, which are required to fetch article text via read_article. The denominazione parameter expects an Italian act-type label like 'LEGGE' or 'DECRETO LEGISLATIVO' — see resource normattiva://tipologiche/denominazioni for the full list.",
      inputSchema: {
        testo: z.string().optional().describe("Keywords searched in the act body."),
        titolo: z.string().optional().describe("Keywords searched in the act title."),
        denominazione: z
          .string()
          .optional()
          .describe(
            "Italian act-type label, e.g. 'LEGGE', 'DECRETO LEGISLATIVO', 'DECRETO DEL PRESIDENTE DELLA REPUBBLICA'.",
          ),
        anno: z.number().int().optional().describe("Year of the provvedimento."),
        numero: z.string().optional().describe("Number of the provvedimento."),
        mese: z.number().int().min(1).max(12).optional(),
        giorno: z.number().int().min(1).max(31).optional(),
        data_emanazione_da: dateString.optional(),
        data_emanazione_a: dateString.optional(),
        data_pubblicazione_da: dateString.optional(),
        data_pubblicazione_a: dateString.optional(),
        classe: z
          .enum(["1", "2", "3"])
          .optional()
          .describe(
            "Vigenza class: 1=senza aggiornamenti (single-version atto), 2=aggiornato, 3=abrogato.",
          ),
        codice_tipo: z
          .string()
          .optional()
          .describe("Faceted filter: act-type code (e.g. 'PLE' for LEGGE)."),
        data_vigenza: dateString
          .optional()
          .describe(
            "Restrict results to atti in force on this date (YYYY-MM-DD). Maps to the spec's 'vigenza' field.",
          ),
        page: z.number().int().min(1).default(1),
        per_page: z.number().int().min(1).max(50).default(5),
        order: z.enum(["recente", "vecchio"]).default("recente"),
      },
    },
    async (args) => {
      const body: RicercaAvanzataBody = {
        orderType: args.order,
        paginazione: {
          paginaCorrente: args.page,
          numeroElementiPerPagina: args.per_page,
        },
      };
      if (args.testo) body.testoRicerca = args.testo;
      if (args.titolo) body.titoloRicerca = args.titolo;
      if (args.denominazione) body.denominazioneAtto = args.denominazione;
      if (args.anno !== undefined) body.annoProvvedimento = String(args.anno);
      if (args.numero) body.numeroProvvedimento = args.numero;
      if (args.mese !== undefined) body.meseProvvedimento = String(args.mese);
      if (args.giorno !== undefined) body.giornoProvvedimento = String(args.giorno);
      if (args.data_emanazione_da) body.dataInizioEmanazione = args.data_emanazione_da;
      if (args.data_emanazione_a) body.dataFineEmanazione = args.data_emanazione_a;
      if (args.data_pubblicazione_da) body.dataInizioPubProvvedimento = args.data_pubblicazione_da;
      if (args.data_pubblicazione_a) body.dataFinePubProvvedimento = args.data_pubblicazione_a;
      if (args.classe) body.classeProvvedimento = args.classe;
      if (args.data_vigenza) body.vigenza = args.data_vigenza;
      if (args.codice_tipo) body.filtriMap = { codice_tipo_provvedimento: args.codice_tipo };

      const data = await ricercaAvanzata(body);
      return jsonContent({
        totale_atti: data.numeroAttiTrovati ?? 0,
        pagine_totali: data.numeroPagine ?? 0,
        pagina_corrente: data.paginaCorrente ?? args.page,
        atti: (data.listaAtti ?? []).map((a) => ({
          anno: a.annoProvvedimento,
          numero: a.numeroProvvedimento,
          denominazione: a.denominazioneAtto,
          descrizione: a.descrizioneAtto,
          titolo: a.titoloAtto,
          codice_redazionale: a.codiceRedazionale,
          data_gu: a.dataGU,
          data_emanazione: a.dataEmanazione,
          data_pubblicazione: a.dataPubblicazione,
          classe: a.classeProvvedimento,
        })),
      });
    },
  );

  server.registerTool(
    "read_article",
    {
      title: "Read one article of an Italian act",
      description:
        "Fetches the text of a single article of a specific atto, at a given date of vigenza. Prefer calling search_acts first to obtain codice_redazionale and data_gu, then list_articles to discover which article numbers exist, and finally read_article on the relevant ones (you may call it in parallel for multiple articles of the same atto). Returns plain text by default; pass format='html' for the original markup (which preserves amendment markers). The text format inlines URN citations as 'L. 5/2003 [urn:nir:stato:legge:2003-06-05;131]'. When the article does not exist (wrong sotto_articolo, id_gruppo or articolo number) the tool returns {found:false, reason, ...} instead of throwing — successful responses include {found:true}. Note: 'bis'/'ter' suffixes require sotto_articolo (1=base, 2=bis, 3=ter, ...), and some atti (e.g. structured codes) require a non-zero id_gruppo whose value is not synchronously discoverable.",
      inputSchema: {
        data_gu: dateString.describe("Publication date in Gazzetta Ufficiale (from search_acts)."),
        codice_redazionale: z.string().describe("Editorial code of the atto (from search_acts)."),
        articolo: z.number().int().describe("Article number."),
        sotto_articolo: z
          .number()
          .int()
          .min(1)
          .default(1)
          .describe("Article suffix index. 1 = base article (e.g. 'art. 13'), 2 = bis, 3 = ter, 4 = quater, ..."),
        sotto_articolo_1: z.number().int().default(0),
        data_vigenza: dateString
          .default(todayIso)
          .describe("Date at which to read the article (defaults to today)."),
        id_gruppo: z.number().int().default(0),
        progressivo: z.number().int().default(0),
        versione: z
          .number()
          .int()
          .default(0)
          .describe(
            "Version selector. 0 (default) is the standard choice and pairs with data_vigenza to return the in-force text on that date.",
          ),
        format: z.enum(["text", "html"]).default("text"),
      },
    },
    async (args) => {
      const data = await dettaglioAtto({
        dataGU: args.data_gu,
        codiceRedazionale: args.codice_redazionale,
        idArticolo: args.articolo,
        sottoArticolo: args.sotto_articolo,
        sottoArticolo1: args.sotto_articolo_1,
        dataVigenza: args.data_vigenza,
        idGruppo: args.id_gruppo,
        progressivo: args.progressivo,
        versione: args.versione,
      });

      if (!data.success || !data.data?.atto) {
        return jsonContent({
          found: false,
          reason: "no-such-article",
          message: data.message ?? null,
          richiesta: {
            articolo: args.articolo,
            sotto_articolo: args.sotto_articolo,
            codice_redazionale: args.codice_redazionale,
            data_gu: args.data_gu,
            data_vigenza: args.data_vigenza,
            id_gruppo: args.id_gruppo,
          },
        });
      }

      const atto = data.data.atto;
      const html = atto.articoloHtml ?? "";
      const articolo_testo = args.format === "html" ? html : htmlToText(html);

      return jsonContent({
        found: true,
        titolo: atto.titolo,
        tipo: atto.tipoProvvedimentoDescrizione,
        codice_tipo: atto.tipoProvvedimentoCodice,
        format: args.format,
        articolo: articolo_testo,
        data_inizio_vigenza: atto.articoloDataInizioVigenza,
        data_fine_vigenza: atto.articoloDataFineVigenza,
      });
    },
  );

  server.registerTool(
    "list_articles",
    {
      title: "List articles of an Italian act (sequential probe)",
      description:
        "Discovers which articles exist in an atto by probing dettaglio-atto sequentially from articolo=1. Normattiva OpenData has no synchronous table-of-contents endpoint, so this is a best-effort enumeration. By default only base articles (sotto_articolo=1) are discovered; pass include_suffixes=true to also probe bis/ter/quater/... for each base article (extra round-trips, stops at the first miss per article). Articles inside structured groups (id_gruppo!=0) are not discovered automatically. Each probe is a real API call. The base probe stops early once a full chunk yields no results after at least one article has been found. Use this before read_article when you need to know the article range.",
      inputSchema: {
        data_gu: dateString.describe("Publication date in Gazzetta Ufficiale (from search_acts)."),
        codice_redazionale: z.string().describe("Editorial code of the atto (from search_acts)."),
        data_vigenza: dateString
          .default(todayIso)
          .describe("Date at which to test article existence (defaults to today)."),
        max_articoli: z
          .number()
          .int()
          .min(1)
          .max(200)
          .default(30)
          .describe("Hard cap on the highest article number to probe."),
        id_gruppo: z
          .number()
          .int()
          .default(0)
          .describe("Article-group id (default 0). Non-zero values target a specific group inside a structured atto."),
        include_suffixes: z
          .boolean()
          .default(false)
          .describe(
            "If true, after finding base articles also probe sotto_articolo=2,3,... for each one until the first miss, discovering bis/ter/quater/... Adds 1-N extra calls per base article.",
          ),
      },
    },
    async (args) => {
      const CHUNK = 5;
      type ArticleEntry = {
        articolo: number;
        sotto_articolo?: number;
        suffisso?: string;
        titolo: string;
        is_preamble?: boolean;
        is_abrogated?: boolean;
      };
      // Whole-article abrogation marker: '((ARTICOLO ABROGATO ...))' inserted by
      // a successive amendment. Distinct from '((COMMA ABROGATO ...))' which only
      // tags individual commi inside an otherwise-live article.
      const ABROGATED_RE = /\(\(\s*ARTICOLO\s+ABROGATO/i;
      const SUFFIX_LABELS = [
        "base",
        "bis",
        "ter",
        "quater",
        "quinquies",
        "sexies",
        "septies",
        "octies",
        "novies",
        "decies",
      ];
      const MAX_SUFFIX_INDEX = SUFFIX_LABELS.length;
      const found: ArticleEntry[] = [];
      let probedUpTo = 0;
      let stoppedEarly = false;

      for (let start = 1; start <= args.max_articoli; start += CHUNK) {
        const end = Math.min(start + CHUNK - 1, args.max_articoli);
        const batch = await Promise.all(
          Array.from({ length: end - start + 1 }, (_, i) => start + i).map(async (n) => {
            try {
              const data = await dettaglioAtto({
                dataGU: args.data_gu,
                codiceRedazionale: args.codice_redazionale,
                idArticolo: n,
                sottoArticolo: 1,
                sottoArticolo1: 0,
                dataVigenza: args.data_vigenza,
                idGruppo: args.id_gruppo,
                progressivo: 0,
                versione: 0,
              });
              if (!data.success || !data.data?.atto?.articoloHtml) {
                return { articolo: n, ok: false as const };
              }
              const html = data.data.atto.articoloHtml;
              // Detect the canonical "Art. N" header. Atti often expose the
              // promulgation preamble at idArticolo=1 with no article header.
              const isArticle = /<h2[^>]*class="[^"]*article-num-akn[^"]*"[^>]*>\s*Art\.\s/i.test(html);
              const text = htmlToText(html);
              const preview = text
                .split("\n")
                .map((l) => l.trim())
                .filter((l) => l.length > 0)
                .slice(0, 4)
                .join(" — ")
                .slice(0, 200);
              return {
                articolo: n,
                ok: true as const,
                titolo: preview,
                is_preamble: !isArticle,
                is_abrogated: ABROGATED_RE.test(text),
              };
            } catch (err) {
              // Treat "article not found" (client-error) as a miss; let
              // network/5xx errors surface so the caller sees the failure
              // instead of getting a silently truncated list.
              if (err instanceof McpError && err.code === ErrorCode.InvalidRequest) {
                return { articolo: n, ok: false as const };
              }
              throw err;
            }
          }),
        );
        probedUpTo = end;
        const hits = batch.filter((b) => b.ok);
        for (const h of hits) {
          if (h.ok) {
            const entry: ArticleEntry = {
              articolo: h.articolo,
              titolo: h.titolo,
            };
            if (h.is_preamble) entry.is_preamble = true;
            if (h.is_abrogated) entry.is_abrogated = true;
            found.push(entry);
          }
        }
        if (hits.length === 0 && found.length > 0) {
          stoppedEarly = true;
          break;
        }
      }

      const suffixHits: ArticleEntry[] = [];
      if (args.include_suffixes && found.length > 0) {
        // Round-by-round probing: at sa=2 probe every base article, then at sa=3
        // only those that hit at sa=2, etc. Stops at the first miss per article,
        // which matches how bis/ter/quater are densely numbered in practice.
        let live = found
          .filter((f) => !f.is_preamble)
          .map((f) => f.articolo);
        for (let sa = 2; sa <= MAX_SUFFIX_INDEX && live.length > 0; sa++) {
          const round = await Promise.all(
            live.map(async (n) => {
              try {
                const data = await dettaglioAtto({
                  dataGU: args.data_gu,
                  codiceRedazionale: args.codice_redazionale,
                  idArticolo: n,
                  sottoArticolo: sa,
                  sottoArticolo1: 0,
                  dataVigenza: args.data_vigenza,
                  idGruppo: args.id_gruppo,
                  progressivo: 0,
                  versione: 0,
                });
                if (!data.success || !data.data?.atto?.articoloHtml) {
                  return { articolo: n, hit: false as const };
                }
                const text = htmlToText(data.data.atto.articoloHtml);
                const preview = text
                  .split("\n")
                  .map((l) => l.trim())
                  .filter((l) => l.length > 0)
                  .slice(0, 4)
                  .join(" — ")
                  .slice(0, 200);
                return {
                  articolo: n,
                  hit: true as const,
                  titolo: preview,
                  is_abrogated: ABROGATED_RE.test(text),
                };
              } catch (err) {
                if (err instanceof McpError && err.code === ErrorCode.InvalidRequest) {
                  return { articolo: n, hit: false as const };
                }
                throw err;
              }
            }),
          );
          const nextLive: number[] = [];
          for (const r of round) {
            if (r.hit) {
              const sx: ArticleEntry = {
                articolo: r.articolo,
                sotto_articolo: sa,
                suffisso: SUFFIX_LABELS[sa - 1] ?? `sotto_articolo_${sa}`,
                titolo: r.titolo,
              };
              if (r.is_abrogated) sx.is_abrogated = true;
              suffixHits.push(sx);
              nextLive.push(r.articolo);
            }
          }
          live = nextLive;
        }
      }

      const articoli: ArticleEntry[] = [];
      for (const base of found) {
        articoli.push(base);
        const itsSuffixes = suffixHits
          .filter((s) => s.articolo === base.articolo)
          .sort((a, b) => (a.sotto_articolo ?? 0) - (b.sotto_articolo ?? 0));
        for (const sx of itsSuffixes) articoli.push(sx);
      }

      return jsonContent({
        codice_redazionale: args.codice_redazionale,
        data_gu: args.data_gu,
        data_vigenza: args.data_vigenza,
        id_gruppo: args.id_gruppo,
        probed_up_to: probedUpTo,
        stopped_early: stoppedEarly,
        truncated: !stoppedEarly && probedUpTo === args.max_articoli,
        include_suffixes: args.include_suffixes,
        articoli_trovati: articoli.length,
        articoli,
      });
    },
  );

  server.registerTool(
    "recent_updates",
    {
      title: "Atti recently modified on Normattiva",
      description:
        "Lists Italian normative acts whose text was modified within a date window. Useful for monitoring legislative changes. The window must be at most 12 months wide and data_fine cannot precede data_inizio.",
      inputSchema: {
        data_inizio: dateString.describe("Start of the modification window (YYYY-MM-DD)."),
        data_fine: dateString.describe("End of the modification window (YYYY-MM-DD), max 12 months after data_inizio."),
      },
    },
    async ({ data_inizio, data_fine }) => {
      const data = await ricercaAggiornati({
        dataInizioAggiornamento: `${data_inizio}T00:00:00.000Z`,
        dataFineAggiornamento: `${data_fine}T23:59:59.999Z`,
      });
      return jsonContent({
        numero_atti: data.numeroAttiTrovati ?? 0,
        atti: (data.listaAtti ?? []).map((a) => ({
          descrizione: a.descrizioneAtto,
          titolo: a.titoloAtto,
          codice_redazionale: a.codiceRedazionale,
          data_gu: a.dataGU,
          data_ultima_modifica: a.dataUltimaModifica,
          ultimi_atti_modificanti: a.ultimiAttiModificanti
            ? a.ultimiAttiModificanti.trim().split(/\s+/)
            : [],
        })),
      });
    },
  );

  server.registerTool(
    "read_act",
    {
      title: "Read an entire Italian act in one call",
      description:
        "Fetches every article of an atto sequentially and returns them aggregated, capped by max_chars (default 80000 ≈ 20k Claude tokens). Useful when you want the whole law text without orchestrating list_articles + N parallel read_article calls. Probes from articolo_da onward, includes bis/ter when include_suffixes=true, and stops at the first empty chunk or when adding the next unit would exceed max_chars. Truncation is reported via {truncated, truncated_reason, articolo_successivo} so the caller can resume by re-invoking with articolo_da set to that value. Each article entry mirrors read_article output (testo + vigenza dates + is_abrogated flag).",
      inputSchema: {
        data_gu: dateString.describe("Publication date in Gazzetta Ufficiale (from search_acts)."),
        codice_redazionale: z.string().describe("Editorial code of the atto (from search_acts)."),
        data_vigenza: dateString
          .default(todayIso)
          .describe("Date at which to read the atto (defaults to today)."),
        format: z.enum(["text", "html"]).default("text"),
        max_chars: z
          .number()
          .int()
          .min(1000)
          .max(500_000)
          .default(80_000)
          .describe(
            "Soft cap on the total number of characters across all aggregated articles. Checked before adding each unit. Default ≈ 20k Claude tokens.",
          ),
        max_articoli: z
          .number()
          .int()
          .min(1)
          .max(200)
          .default(50)
          .describe("Hard cap on how many base article numbers to probe past articolo_da."),
        articolo_da: z
          .number()
          .int()
          .min(1)
          .default(1)
          .describe("Starting article number. Set to articolo_successivo from a previous truncated response to resume."),
        include_suffixes: z
          .boolean()
          .default(false)
          .describe(
            "If true, after each base article also fetch its bis/ter/quater/... chain. Each suffix counts against max_chars. If the budget runs out mid-chain, the remaining suffixes of that article are skipped — fetch them with read_article if needed.",
          ),
        id_gruppo: z
          .number()
          .int()
          .default(0)
          .describe("Article-group id. Non-zero values target a specific group inside a structured atto."),
      },
    },
    async (args) => {
      const CHUNK = 5;
      const SUFFIX_LABELS = [
        "base",
        "bis",
        "ter",
        "quater",
        "quinquies",
        "sexies",
        "septies",
        "octies",
        "novies",
        "decies",
      ];
      const ABROGATED_RE = /\(\(\s*ARTICOLO\s+ABROGATO/i;

      type Aggregated = {
        articolo: number;
        sotto_articolo?: number;
        suffisso?: string;
        testo: string;
        data_inizio_vigenza?: string;
        data_fine_vigenza?: string;
        is_preamble?: boolean;
        is_abrogated?: boolean;
        suffixes_truncated?: boolean;
      };

      const articoli: Aggregated[] = [];
      let totalChars = 0;
      let attoTitolo: string | undefined;
      let attoTipo: string | undefined;
      let attoCodiceTipo: string | undefined;
      let probedUpTo = args.articolo_da - 1;
      let stoppedEarly = false;
      let truncatedReason: "max_chars" | null = null;
      let articoloSuccessivo: number | null = null;

      const fetchUnit = async (n: number, sa: number) => {
        try {
          const data = await dettaglioAtto({
            dataGU: args.data_gu,
            codiceRedazionale: args.codice_redazionale,
            idArticolo: n,
            sottoArticolo: sa,
            sottoArticolo1: 0,
            dataVigenza: args.data_vigenza,
            idGruppo: args.id_gruppo,
            progressivo: 0,
            versione: 0,
          });
          if (!data.success || !data.data?.atto?.articoloHtml) return null;
          const atto = data.data.atto;
          const html = atto.articoloHtml;
          // Narrow for TS: the guard above already excluded undefined.
          if (typeof html !== "string") return null;
          attoTitolo ??= atto.titolo;
          attoTipo ??= atto.tipoProvvedimentoDescrizione;
          attoCodiceTipo ??= atto.tipoProvvedimentoCodice;
          const isArticle = /<h2[^>]*class="[^"]*article-num-akn[^"]*"[^>]*>\s*Art\.\s/i.test(html);
          const testo = args.format === "html" ? html : htmlToText(html);
          return {
            testo,
            isArticle,
            // The '((ARTICOLO ABROGATO' marker is plain text in both formats —
            // test on the raw HTML to avoid an extra conversion when format=html.
            isAbrogated: ABROGATED_RE.test(html),
            atto,
          };
        } catch (err) {
          if (err instanceof McpError && err.code === ErrorCode.InvalidRequest) return null;
          throw err;
        }
      };

      const upperBound = args.articolo_da + args.max_articoli - 1;
      outer: for (let start = args.articolo_da; start <= upperBound; start += CHUNK) {
        const end = Math.min(start + CHUNK - 1, upperBound);
        const numbers = Array.from({ length: end - start + 1 }, (_, i) => start + i);
        const baseResults = await Promise.all(
          numbers.map((n) => fetchUnit(n, 1).then((r) => ({ n, r }))),
        );
        probedUpTo = end;

        const hits = baseResults.filter((x) => x.r !== null);
        if (hits.length === 0 && articoli.length > 0) {
          stoppedEarly = true;
          break;
        }

        for (const { n, r } of baseResults) {
          if (!r) continue;

          if (totalChars + r.testo.length > args.max_chars && articoli.length > 0) {
            truncatedReason = "max_chars";
            articoloSuccessivo = n;
            break outer;
          }

          const entry: Aggregated = {
            articolo: n,
            testo: r.testo,
            data_inizio_vigenza: r.atto.articoloDataInizioVigenza,
            data_fine_vigenza: r.atto.articoloDataFineVigenza,
          };
          if (!r.isArticle) entry.is_preamble = true;
          if (r.isAbrogated) entry.is_abrogated = true;
          articoli.push(entry);
          totalChars += r.testo.length;

          if (args.include_suffixes && r.isArticle) {
            for (let sa = 2; sa < SUFFIX_LABELS.length; sa++) {
              const sx = await fetchUnit(n, sa);
              if (!sx) break;
              if (totalChars + sx.testo.length > args.max_chars) {
                truncatedReason = "max_chars";
                articoloSuccessivo = n + 1;
                entry.suffixes_truncated = true;
                break outer;
              }
              const sxEntry: Aggregated = {
                articolo: n,
                sotto_articolo: sa,
                suffisso: SUFFIX_LABELS[sa - 1] ?? `sotto_articolo_${sa}`,
                testo: sx.testo,
                data_inizio_vigenza: sx.atto.articoloDataInizioVigenza,
                data_fine_vigenza: sx.atto.articoloDataFineVigenza,
              };
              if (sx.isAbrogated) sxEntry.is_abrogated = true;
              articoli.push(sxEntry);
              totalChars += sx.testo.length;
            }
          }
        }
      }

      const exhaustedRange =
        truncatedReason === null && probedUpTo >= upperBound && !stoppedEarly;

      return jsonContent({
        titolo: attoTitolo ?? null,
        tipo: attoTipo ?? null,
        codice_tipo: attoCodiceTipo ?? null,
        codice_redazionale: args.codice_redazionale,
        data_gu: args.data_gu,
        data_vigenza: args.data_vigenza,
        format: args.format,
        articolo_da: args.articolo_da,
        probed_up_to: probedUpTo,
        stopped_early: stoppedEarly,
        truncated: truncatedReason !== null || exhaustedRange,
        truncated_reason: truncatedReason ?? (exhaustedRange ? "max_articoli" : null),
        articolo_successivo:
          articoloSuccessivo ?? (exhaustedRange ? upperBound + 1 : null),
        char_count: totalChars,
        articoli_inclusi: articoli.length,
        include_suffixes: args.include_suffixes,
        articoli,
      });
    },
  );
}
