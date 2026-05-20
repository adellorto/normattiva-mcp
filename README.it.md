# normattiva-mcp

[English](./README.md) · **Italiano**

Server [Model Context Protocol](https://modelcontextprotocol.io) leggero che espone l'API OpenData di [Normattiva](https://www.normattiva.it) — il portale ufficiale della legislazione italiana gestito da IPZS — a client LLM come Claude Desktop, Cursor e Claude Code.

Wrappa gli endpoint sincroni di lettura (ricerca, dettaglio atto, atti aggiornati) e i cataloghi delle tipologiche statiche come **tools**, **resources** e **prompts** MCP.

**Landing page & quickstart:** [`normattiva-mcp.adellorto.com`](https://normattiva-mcp.adellorto.com/) — config copia-incolla per Claude, ChatGPT, Cursor e stdio. Versione italiana su [`/it/`](https://normattiva-mcp.adellorto.com/it/).

## Funzionalità

### Tools

| Tool | Scopo |
| --- | --- |
| `search_acts` | Ricerca atti normativi italiani per testo libero, titolo, denominazione atto, anno/numero, intervallo di date, classe provvedimento o data di vigenza. Restituisce i metadati di ciascun atto trovato, incluso `codice_redazionale` e `data_gu` (necessari a `read_article`). Per trovare atti **appena pubblicati** in Gazzetta Ufficiale in una finestra temporale, valorizza `data_pubblicazione_da` / `data_pubblicazione_a` — è questo lo strumento giusto per "cosa è stato pubblicato di recente?", non `recent_updates`. |
| `list_articles` | Scopre i numeri degli articoli di un atto sondando in sequenza `read_article` a partire da `articolo=1`. Per default trova solo gli articoli base; con `include_suffixes: true` sonda anche `bis`/`ter`/`quater`/… per ognuno. Ogni voce porta i flag opzionali `is_preamble` e `is_abrogated` (informativi; nessun filtro lato server). Gli articoli interni a gruppi strutturati (`id_gruppo != 0`) non vengono enumerati automaticamente. |
| `read_article` | Recupera il testo di un singolo articolo di uno specifico atto a una data di vigenza. Per default ritorna testo semplice; con `format: "html"` restituisce il markup originale (preserva i marcatori di emendamento). In modalità testo i target dei link sono inlinati come `L. 5/2003 [urn:nir:stato:legge:2003-06-05;131]` così le citazioni URN sopravvivono alla conversione. Le risposte di successo includono `found: true`; articoli inesistenti (`sotto_articolo`, `id_gruppo` errato o `articolo` fuori range) ritornano `{ found: false, reason, richiesta }` senza sollevare eccezioni — il sondaggio è exception-free. L'LLM può chiamarlo in parallelo per più articoli dello stesso atto. |
| `read_act` | Lettura aggregata di un intero atto: enumera internamente gli articoli e ne recupera ognuno, ritornandoli in ordine fino al limite `max_chars` (default 80 000 ≈ 20k token Claude). Onora `include_suffixes` e `id_gruppo` come `list_articles`. Quando il budget è esaurito la risposta include `truncated: true`, `truncated_reason` e `articolo_successivo` per riprendere con una chiamata successiva impostando `articolo_da` a quel valore. |
| `recent_updates` | Elenca atti normativi il cui **testo consolidato è stato modificato** in una finestra temporale (max 12 mesi) — cioè la versione vigente è cambiata perché un altro atto l'ha modificata. **Non** elenca atti appena pubblicati in Gazzetta Ufficiale; per quelli usa `search_acts` con `data_pubblicazione_da` / `data_pubblicazione_a`. |

### Resources

| URI | Contenuto |
| --- | --- |
| `normattiva://tipologiche/denominazioni` | Codici di denominazione atto (es. `PLE` → `LEGGE`, `PDL` → `DECRETO-LEGGE`). Usa il value come argomento `denominazione` di `search_acts`. |
| `normattiva://tipologiche/classi-provvedimento` | Codici classe provvedimento: `1` = atto normativo senza aggiornamenti, `2` = aggiornato, `3` = abrogato. |
| `normattiva://collezioni-predefinite` | Collezioni preconfezionate di atti con il numero di elementi di ciascuna. |
| `normattiva://ricerche-predefinite` | Ricerche predefinite con i relativi filtri preimpostati. |

### Prompts

| Nome | Argomenti | Scopo |
| --- | --- | --- |
| `ricerca-articolo` | `argomento` | Cerca la normativa italiana su un argomento e legge gli articoli più rilevanti. |
| `monitoraggio-modifiche` | `giorni` (default `7`) | Riepiloga le modifiche al testo consolidato di atti esistenti negli ultimi *N* giorni (usa `recent_updates`; per atti appena pubblicati usa invece `search_acts` con `data_pubblicazione_da/a`). |

## Installazione e configurazione del client

Eseguilo con `npx`:

```bash
npx normattiva-mcp
```

### Claude Desktop / Claude Code

Aggiungi alla configurazione del tuo client MCP (`claude_desktop_config.json` per Claude Desktop, oppure `~/.claude.json` / `.mcp.json` per Claude Code):

```json
{
  "mcpServers": {
    "normattiva": {
      "command": "npx",
      "args": ["-y", "normattiva-mcp"]
    }
  }
}
```

### Cursor

In `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "normattiva": {
      "command": "npx",
      "args": ["-y", "normattiva-mcp"]
    }
  }
}
```

## Configurazione

Il server dialoga sempre con l'**ambiente di esercizio dell'API OpenData** di Normattiva (`https://api.normattiva.it/t/normattiva.api`). L'endpoint è hard-coded — non c'è alcuna variabile d'ambiente per sovrascriverlo. L'ambiente di test (PRE) non è supportato di proposito perché protetto da mTLS.

L'API OpenData è aperta e non richiede autenticazione.

## Trasporto HTTP

Oltre al binario stdio pubblicato su npm, il repo include anche `packages/http-server/` — un deploy su Vercel dello stesso server MCP sul trasporto Streamable HTTP. Utile per i client che hanno bisogno di un endpoint remoto invece di un sottoprocesso locale.

**Endpoint hosted:** `https://normattiva-mcp.adellorto.com/api/mcp` — gratuito, nessuna registrazione, nessuna autenticazione.

Configurazione client:

```json
{
  "mcpServers": {
    "normattiva": {
      "url": "https://normattiva-mcp.adellorto.com/api/mcp"
    }
  }
}
```

### Self-hosting

Per eseguire una propria copia su un account Vercel:

```bash
git clone https://github.com/adellorto/normattiva-mcp.git
cd normattiva-mcp
pnpm install
cd packages/http-server
npx vercel deploy
```

L'handler espone solo Streamable HTTP (SSE è rimosso dalla spec MCP 2025-03-26). Nessuna autenticazione di default — chiunque conosca l'URL può chiamarlo.

## Build da sorgente

Richiede Node.js ≥ 20.

```bash
git clone <repo>
cd normattiva-mcp
npm install
npm run build
node dist/index.js  # parla MCP via stdio
```

Smoke test live (chiama l'API pubblica):

```bash
node tests/smoke.mjs
```

## Note e limitazioni

- **Nessun endpoint di indice articoli.** Normattiva OpenData non espone un sommario sincrono. `list_articles` è un sondaggio best-effort: chiama `read_article` per `articolo=1,2,3,…` finché smette di trovare risultati. Per default scopre solo gli **articoli base**; `include_suffixes: true` estende il sondaggio a `bis`/`ter`/`quater`/… (round-by-round, fermando ciascuna catena al primo miss) ma non può trovare sotto-articoli il cui base manca, né articoli interni a gruppi strutturati (`id_gruppo != 0`).
- **`id_gruppo` è opaco.** Alcuni atti — tipicamente codici strutturati (codici, testi unici, leggi articolate) — restituiscono contenuto solo quando `read_article` viene chiamato con un `id_gruppo` non zero. L'API OpenData non offre alcun modo sincrono per scoprire il valore corretto. Strategia pratica: provare prima con `id_gruppo=0`; se i risultati appaiono vuoti o errati, provare interi piccoli (1, 2, 3, …) finché l'articolo non torna.
- **Un articolo per chiamata upstream.** L'endpoint `dettaglio-atto` di Normattiva serve un articolo alla volta. `read_article` lo espone direttamente (parallelizza dal client quando leggi più articoli); `read_act` nasconde l'orchestrazione e restituisce un payload aggregato unico, limitato da `max_chars` e ripristinabile via `articolo_successivo`.
- **Stripping dell'HTML.** Il default `format: "text"` collassa il markup HTML di Normattiva ma preserva i marcatori italiani di emendamento `(( ... ))` (inserimenti) e `[ ... ]` (cancellazioni), che hanno valore semantico. I link verso altri atti normativi sono inlinati come `<testo> [urn:nir:…]` così l'URN Akoma Ntoso sopravvive in formato testo.
- **Versioning degli articoli non scopribile.** Ogni chiamata `read_article` ritorna la versione dell'articolo in vigore alla `data_vigenza` (default `versione=0` dell'API). L'API OpenData non espone quante versioni storiche esistano per un articolo, quindi i testi precedenti possono essere recuperati solo variando `data_vigenza` (o tentando `versione=1, 2, …`).
- **`is_abrogated` è euristico.** Il flag riconosce il marcatore canonico `((ARTICOLO ABROGATO …))` che gli emendamenti successivi inseriscono in testa a un articolo interamente abrogato. Articoli con singoli commi abrogati ma articolo nel complesso vivo (es. `((COMMA ABROGATO …))` in alcune sottosezioni) **non** vengono segnalati.
- **Export asincrono e ambiente PRE** (protetto da mTLS) **non** sono wrappati — il server resta leggero e sincrono.
- **`recent_updates`** tratta `data_fine` come fine giornata inclusiva (UTC). La finestra è limitata dall'API a 12 mesi e 7000 atti; entrambi i limiti emergono come codici di errore IPZS (`1501`, `1502`).

## Licenza

Il codice sorgente di questo server è MIT — vedi [LICENSE](./LICENSE).

I contenuti normativi recuperati tramite questo server sono pubblicati da IPZS con licenza [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Il server è un pass-through e non rilicenzia il contenuto: qualunque uso o redistribuzione a valle deve attribuire Normattiva / IPZS come fonte.

Normattiva è un marchio dell'Istituto Poligrafico e Zecca dello Stato Italiano (IPZS); questo progetto non è affiliato né sponsorizzato da IPZS.
