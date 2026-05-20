# normattiva-mcp

**English** · [Italiano](./README.it.md)

A lightweight [Model Context Protocol](https://modelcontextprotocol.io) server that exposes the [Normattiva](https://www.normattiva.it) OpenData API — the official Italian legislation portal run by IPZS — to LLM clients like Claude Desktop, Cursor, and Claude Code.

It wraps the synchronous read endpoints (search, article detail, recent updates) and the static reference catalogs as MCP **tools**, **resources**, and **prompts**.

## Capabilities

### Tools

| Tool | Purpose |
| --- | --- |
| `search_acts` | Search Italian legislation by free text, title, act type, year/number, date range, vigenza class, or in-force date. Returns metadata for each matching atto including `codice_redazionale` and `data_gu` (which `read_article` needs). To find acts **newly published** in Gazzetta Ufficiale within a window, set `data_pubblicazione_da` / `data_pubblicazione_a` — this is the right tool for "what was published recently?", not `recent_updates`. |
| `list_articles` | Discover the article numbers of an atto by sequentially probing `read_article` from `articolo=1`. Finds base articles by default; pass `include_suffixes: true` to also probe `bis`/`ter`/`quater`/… for each one. Each entry carries optional `is_preamble` and `is_abrogated` flags (informational; nothing is filtered server-side). Articles inside structured groups (`id_gruppo != 0`) are still not enumerated automatically. |
| `read_article` | Fetch the text of a single article of a specific atto at a given date of vigenza. Returns plain text by default; pass `format: "html"` for the original markup (preserves amendment markers). In text mode, hyperlink targets are inlined as `L. 5/2003 [urn:nir:stato:legge:2003-06-05;131]` so URN citations survive the conversion. Successful responses include `found: true`; non-existent articles (wrong `sotto_articolo`, `id_gruppo`, or out-of-range `articolo`) return `{ found: false, reason, richiesta }` instead of throwing — so probing is exception-free. The LLM can call this in parallel for several articles of the same atto. |
| `read_act` | Aggregate-read of an entire atto: internally enumerates articles and fetches each one, returning them in order capped by `max_chars` (default 80 000 ≈ 20k Claude tokens). Honors `include_suffixes` and `id_gruppo` like `list_articles`. When the budget is exhausted the response includes `truncated: true`, `truncated_reason`, and `articolo_successivo` for resuming via a follow-up call with `articolo_da` set to that value. |
| `recent_updates` | Lists atti normativi whose **consolidated text was amended** within a date window (max 12 months) — i.e. the in-force version changed because another act modified it. Does **not** list acts newly published in Gazzetta Ufficiale; for those, use `search_acts` with `data_pubblicazione_da` / `data_pubblicazione_a`. |

### Resources

| URI | Contents |
| --- | --- |
| `normattiva://tipologiche/denominazioni` | Act-type codes (e.g. `PLE` → `LEGGE`, `PDL` → `DECRETO-LEGGE`). Use the value as the `denominazione` argument of `search_acts`. |
| `normattiva://tipologiche/classi-provvedimento` | Vigenza class codes: `1` = senza aggiornamenti, `2` = aggiornato, `3` = abrogato. |
| `normattiva://collezioni-predefinite` | Predefined collections of acts with their item counts. |
| `normattiva://ricerche-predefinite` | Predefined searches with their preset filters. |

### Prompts

| Name | Args | Purpose |
| --- | --- | --- |
| `ricerca-articolo` | `argomento` | Search Italian law on a topic and read the most relevant articles. |
| `monitoraggio-modifiche` | `giorni` (default `7`) | Summarize amendments to the consolidated text of existing acts in the last *N* days (uses `recent_updates`; for newly published acts use `search_acts` with `data_pubblicazione_da/a`). |

## Installation & client configuration

Run via `npx`:

```bash
npx normattiva-mcp
```

### Claude Desktop / Claude Code

Add to your MCP client config (`claude_desktop_config.json` for Claude Desktop, or `~/.claude.json` / `.mcp.json` for Claude Code):

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

## Configuration

The server always talks to Normattiva's **production OpenData API** (`https://api.normattiva.it/t/normattiva.api`). The endpoint is hard-coded — there is no environment variable to override it. The PRE/test environment is intentionally not supported because it is mTLS-protected.

The OpenData API is open and does not require authentication.

## HTTP transport

In addition to the npm-published stdio binary, this repo also ships `packages/http-server/` — a Vercel deployment of the same MCP server over the Streamable HTTP transport. Useful for clients that need a remote endpoint instead of a local subprocess.

**Hosted endpoint:** `https://normattiva-mcp.adellorto.com/api/mcp` — free, no signup, no auth.

**Landing page:** [`normattiva-mcp.adellorto.com`](https://normattiva-mcp.adellorto.com/) — copy-paste client configs for Claude, ChatGPT and stdio. Italian version at [`/it/`](https://normattiva-mcp.adellorto.com/it/).

Client config:

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

To run your own copy on a Vercel account:

```bash
git clone https://github.com/adellorto/normattiva-mcp.git
cd normattiva-mcp
pnpm install
cd packages/http-server
npx vercel deploy
```

The handler exposes only Streamable HTTP (SSE is removed from the 2025-03-26 MCP spec). No authentication by default — anyone with the URL can call it.

## Building from source

Requires Node.js ≥ 20.

```bash
git clone <repo>
cd normattiva-mcp
npm install
npm run build
node dist/index.js  # speaks MCP on stdio
```

A live smoke test (hits the public API):

```bash
node tests/smoke.mjs
```

## Notes & limitations

- **No table-of-contents endpoint.** Normattiva OpenData has no synchronous TOC. `list_articles` is a best-effort probe: it calls `read_article` for `articolo=1,2,3,…` until it stops finding results. By default it discovers **base articles** only; `include_suffixes: true` extends the probe to `bis`/`ter`/`quater`/… (round-by-round, stopping each chain at the first miss) but cannot find sub-articles whose base is missing, nor articles inside structured groups (`id_gruppo != 0`).
- **`id_gruppo` is opaque.** Some atti — typically structured codes (codici, testi unici, leggi articolate) — return content only when `read_article` is called with a non-zero `id_gruppo`. The OpenData API offers no way to discover the right value synchronously. Practical strategy: try `id_gruppo=0` first; if results look empty or wrong, try small integers (1, 2, 3, …) until the article comes back.
- **One article per call upstream.** Normattiva's `dettaglio-atto` endpoint serves one article at a time. `read_article` exposes that directly (parallelize from the client when reading several articles); `read_act` hides the orchestration and returns a single aggregated payload, capped by `max_chars` and resumable via `articolo_successivo`.
- **HTML stripping.** The default `format: "text"` collapses Normattiva's HTML markup but preserves the Italian-law amendment markers `(( ... ))` (insertions) and `[ ... ]` (deletions), which carry semantic meaning. Hyperlinks to other normative acts are inlined as `<text> [urn:nir:…]` so the Akoma Ntoso URN survives in plain text.
- **Article versioning is non-discoverable.** Each `read_article` call returns the version of the article in force on `data_vigenza` (the API's `versione=0` default). The OpenData API does not expose how many historical versions exist for an article, so previous texts can only be retrieved by varying `data_vigenza` (or by guessing `versione=1, 2, …`).
- **`is_abrogated` is heuristic.** The flag matches the canonical `((ARTICOLO ABROGATO …))` marker that successive amendments insert at the head of a wholly-abrogated article. Articles where individual commi are abrogated but the article itself is alive (e.g. `((COMMA ABROGATO …))` in a few subsections) are **not** flagged.
- **Async export and PRE environment** (mTLS-protected) are **not** wrapped — this server stays light and synchronous.
- **`recent_updates`** treats `data_fine` as inclusive end-of-day (UTC). The window is capped at 12 months and 7000 atti by the API; both limits surface as IPZS error codes (`1501`, `1502`).

## License

This server's source code is MIT — see [LICENSE](./LICENSE).

Legislative content retrieved through this server is published by IPZS under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The server is a pass-through and does not relicense the content: any downstream use or redistribution must attribute Normattiva / IPZS as the source.

Normattiva is a trademark of the Istituto Poligrafico e Zecca dello Stato Italiano (IPZS); this project is not affiliated with or endorsed by IPZS.
