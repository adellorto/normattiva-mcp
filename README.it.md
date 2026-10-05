# normattiva-mcp

[English](./README.md) · **Italiano**

[![Listed in italia-mcp-servers](https://img.shields.io/badge/listed%20in-italia--mcp--servers-blue)](https://github.com/bsab/italia-mcp-servers)

Un server [Model Context Protocol](https://modelcontextprotocol.io) per la normativa italiana ufficiale di [Normattiva](https://www.normattiva.it), gestito da IPZS. Ricerca di atti, indice degli articoli a una data precisa e lettura limitata sono condivisi dai trasporti stdio e Streamable HTTP.

## Stato dello sviluppo

Questa revisione implementa le fasi 1–4 della [specifica accettata](https://github.com/adellorto/normattiva-mcp/issues/6#issuecomment-5992182865). Entrambi i server predefiniti espongono la nuova interfaccia descritta sotto. È **non pubblicata**: il pacchetto npm, l'endpoint ospitato e la pagina pubblica riflettono ancora la versione precedente. Gli esempi della nuova interfaccia valgono subito per una compilazione dai sorgenti e, dopo la pubblicazione, per il rilascio coordinato.

La versione candidata **0.2.0** è preparata localmente. Le verifiche della fase 5 su pacchetto, runtime, token e brevi sessioni terminale sono registrate nel [resoconto di accettazione](docs/implementation/release-acceptance.md). L'accettazione è incompleta: le fonti live bloccano la validazione, Terra ha alterato un cursore e restano le verifiche estese su modelli e deployment. I test offline non dimostrano accettazione in produzione o affidabilità dei modelli. Dettagli: [lettura validata](docs/implementation/validated-reading.md), [ricerca di atti](docs/implementation/act-discovery.md), [integrazione pubblica](docs/implementation/public-integration.md). La [guida alla migrazione incompatibile](docs/migration.md) elenca campi e chiamate rimossi.

## Funzionalità

### Strumenti

| Strumento | Scopo |
| --- | --- |
| `find_acts` | Individua atti da un unico `request`: citazione, nome comune/acronimo verificato, argomento o vincoli espliciti di data/stato supportati. Restituisce `identified`, `candidates` o `no_candidates`, riferimenti agli atti e intenzione relativa all'articolo separata; mai il testo. Una ricerca vuota non prova assenza. |
| `continue_acts` | Continua la ricerca con il solo `cursor` restituito, copiato letteralmente. Il corpus è live; il completamento non prova esaustività giuridica. |
| `list_articles` | Restituisce pagine di occorrenze verificate, rubriche disponibili, gerarchia e riferimenti agli allegati per un `act_locator` a una `snapshot_date` precisa. Continua con solo `cursor` ed eventuale `page_size`; valuta la copertura separatamente dall'avanzamento. |
| `read_article` | Legge un `article_locator` esatto, oppure `act_locator` e `article_reference`, senza indice obbligatorio. Restituisce `found`, `absent` sostenuto da prove, oppure `unresolved`. Continua all'interno del testo con solo `cursor` ed eventuale `max_chars`. |
| `read_act` | Legge pagine limitate di testo e celle strutturate da un `act_locator`, eventualmente selezionando un `attachment_ref` elencato. Continua dentro testo/celle con solo `cursor` ed eventuale `max_chars`. Completamento e copertura del contenuto giuridico sono distinti. |
| `recent_updates` | Elenca atti il cui **testo consolidato è stato modificato** in un intervallo inclusivo di massimo dodici mesi, fornendo riferimenti agli atti. Per **nuove pubblicazioni in Gazzetta**, usa `find_acts` con un intervallo esplicito di pubblicazione. I soli metadati non spiegano le modifiche. |

### Risorse

| URI | Contenuto |
| --- | --- |
| `normattiva://tipologiche/denominazioni` | Codici ufficiali dei tipi di atto e nomi italiani; metadati facoltativi di riferimento. |
| `normattiva://tipologiche/classi-provvedimento` | Classi ufficiali: `1` = senza aggiornamenti, `2` = aggiornato, `3` = abrogato; non attestano lo stato attuale di un atto selezionato. |
| `normattiva://collezioni-predefinite` | Collezioni ufficiali predefinite e conteggi. |
| `normattiva://ricerche-predefinite` | Ricerche ufficiali predefinite e filtri upstream, per consultazione anziché come argomenti diretti degli strumenti. |

La ricerca accetta direttamente la richiesta dell'utente; consultare questi cataloghi è facoltativo.

### Prompt

| Nome | Argomenti | Scopo |
| --- | --- | --- |
| `ricerca-articolo` | `argomento` | Ricerca facoltativa: seleziona fino a 3 atti mediante ricerca e rubriche effettive dell'indice, legge fino a 10 articoli, cita solo testi letti e dichiara la copertura. Segue altri cursori per richieste esplicitamente esaustive. |
| `monitoraggio-modifiche` | `giorni` (1–365, default `7`) | Raggruppa i metadati degli atti con testo consolidato modificato. Legge contenuti pertinenti e datati prima di descrivere le modifiche; usa `find_acts` per nuove pubblicazioni. |

Le indicazioni essenziali sono nelle descrizioni e nei risultati degli strumenti. L'uso ordinario non richiede prompt, cataloghi allegati o istruzioni di inizializzazione.

## Ricerca e lettura

Mantieni richiesta e vincoli insieme:

```json
{"name":"find_acts","arguments":{"request":"decreto legislativo 267/2000 articolo 13"}}
```

Seleziona l'`act_locator` del candidato restituito. La ricerca separa `article_reference`. Sostituisci il riferimento nell'esempio con il valore effettivo:

```json
{"name":"read_article","arguments":{"act_locator":"<act_locator restituito>","article_reference":"13","snapshot_date":"2026-10-02"}}
```

Per suffissi, atti strutturati o occorrenze ripetute, scegli l'`article_locator` esatto da `list_articles`. Non ricostruire coordinate interne e non scegliere una generazione dalla memoria del modello. `candidates` richiede ancora selezione. Alias controllati e identità verificata live non provano la vigenza attuale: i candidati indicano al momento `current: "unknown"`.

La ricerca prosegue con `continue_acts({cursor})`. Indice e lettura proseguono richiamando lo stesso strumento con `{cursor}` ed eventuale nuovo limite. Copia il cursore letteralmente e ometti riferimenti/data originali. `find_acts` e `continue_acts` non espongono un limite pubblico di candidati.

La lettura risolve una data omessa alla data UTC concreta della prima chiamata. I riferimenti mantengono istantanea e rappresentazione anche dopo riavvio o svuotamento della cache. Per cambiare data, avvia una nuova richiesta. Le pagine di ricerca restano live e possono cambiare ordine o appartenenza; modifiche durante una continuazione interna alla pagina producono errore esplicito.

## Esiti, avanzamento e limiti

Gli strumenti riusciti espongono JSON concordante in `structuredContent` e nel contenuto testuale. L'`outcome` dell'articolo è distinto dall'esecuzione: `found` contiene `content.text`; `absent` richiede prove positive e `absence_basis`; `unresolved` non stabilisce presenza o assenza. Un 404 upstream ambiguo non prova assenza.

Indice, lettura dell'atto e ricerca usano `traversal`; l'articolo singolo usa `progress` al livello principale. `pending` indica preparazione senza contenuti utili (solo indice/atto), `more` un'altra pagina, `complete` la fine dell'attraversamento osservato. `interrupted` conserva il prefisso utile con cursore, `failure.error` e posizione incompiuta. Un errore prima di progressi utili usa `isError: true` e `structuredContent.error`: categoria, codice, messaggio sicuro, `retryability` (`true`, `false` o `"unknown"`) e dettagli applicabili di provider/HTTP/trasporto/attesa. Ripetibilità sconosciuta non autorizza tentativi automatici. Input incompatibili con lo schema possono ricevere l'errore di validazione dell'SDK MCP.

| Limite | Predefinito | Massimo |
| --- | --- | --- |
| Candidati per pagina | 5 | 20 configurati internamente; chiamate pubbliche con valore predefinito |
| Voci dell'indice per pagina | 30 | 50 |
| Caratteri di testo per pagina | 16.000 | 64.000 |
| Risposta serializzata completa, entrambe le rappresentazioni MCP | — | 128 KiB UTF-8 |
| Acquisizione della fonte decodificata | — | 24 MiB |

I limiti testuali contano punti di codice Unicode; gli offset dei segmenti sono posizioni UTF-16. Identità, dimensioni, celle, span, intestazioni e offset delle tabelle persistono tra pagine. Il limite in byte può ridurre ulteriormente una pagina: il contenuto supportato continua anziché essere saltato. Voci non rappresentabili e limiti di fonte/parser producono errori espliciti.

Una sola richiesta upstream attiva per processo; scadenza condivisa di 50 secondi, massimo 20 secondi per tentativo, due tentativi per letture dirette o sedici per operazioni composte. I ritentativi richiedono ripetibilità sicura e prove di errore transitorio noto; la continuazione ha un nuovo budget. Client e hosting devono lasciare tempo per restituire la risposta dopo la scadenza; HTTP consente 60 secondi. La cancellazione interrompe lavoro in coda e attivo.

## Configurazione e fiducia nei riferimenti

I nuovi server richiedono `NORMATTIVA_REFERENCE_KEY`: esattamente 64 caratteri esadecimali per una chiave di 32 byte generata crittograficamente. Generala **una volta**, poi conservala nell'ambiente del client o nei segreti del deployment:

```bash
openssl rand -hex 32
export NORMATTIVA_REFERENCE_KEY='<incolla la chiave persistente di 64 caratteri hex>'
```

Il server legge l'ambiente del processo; non carica automaticamente `.env`, non crea chiavi e non include un segreto condiviso. Configurazione assente o malformata fallisce esplicitamente. Processi compatibili con la stessa chiave conservata verificano riferimenti firmati dopo riavvio; trasferimenti tra hosting e npm richiedono anche fiducia condivisa e versioni compatibili. Perdere/cambiare chiave invalida riferimenti firmati e richiede nuove ricerche/letture. Deployment con fiducia diversa rifiutano i riferimenti.

Formati: `a1_` riferimenti portabili alla pubblicazione validata (non prove di esistenza); `n1_` riferimenti esatti e cursori firmati di lettura; `d1_` cursori firmati della ricerca live. Riferimenti non supportati/manomessi/non fidati falliscono senza riavvii silenziosi o richieste a host scelti dal chiamante. Nessun database dei cursori.

Le destinazioni sono host ufficiali fissi dell'API e del sito Normattiva in produzione. L'API aperta non richiede autenticazione. L'ambiente PRE con mTLS è escluso.

## Client e HTTP

Dopo il rilascio coordinato, i client stdio potranno eseguire `npx normattiva-mcp` con la chiave persistente. Finché questa fase non è pubblicata, usa il percorso dei sorgenti compilati:

```json
{
  "mcpServers": {
    "normattiva": {
      "command": "node",
      "args": ["/percorso/assoluto/normattiva-mcp/packages/stdio-server/dist/index.js"],
      "env": { "NORMATTIVA_REFERENCE_KEY": "<chiave persistente di 64 caratteri hex>" }
    }
  }
}
```

L'endpoint esistente `https://normattiva-mcp.adellorto.com/api/mcp` non ha ancora questa migrazione. I client remoti non ricevono il segreto; lo configura il gestore. Copie compatibili ospitate autonomamente espongono gli stessi sei strumenti via Streamable HTTP, con CORS permissivo e senza autenticazione predefinita.

Per Vercel configura la chiave persistente nell'ambiente del deployment, compila i pacchetti e distribuisci dalla **radice del repository** dove risiede `.vercel/project.json`. Esegui `vercel deploy --prod` solo quando pronto a pubblicare. Push, pubblicazione npm e deployment restano all'utente. Pagine e configurazioni attualmente pubblicate: [inglese](https://normattiva-mcp.adellorto.com/), [italiano](https://normattiva-mcp.adellorto.com/it/).

## Compilazione e verifiche

Node.js ≥20 e pnpm. I test deterministici sono attualmente eseguiti su Node 24; il test del vero handler HTTP usa il supporto TypeScript di Node.

```bash
pnpm install
pnpm build
# Configura prima NORMATTIVA_REFERENCE_KEY con la chiave persistente.
pnpm start
pnpm test
```

`pnpm test` non contatta API pubbliche. Con una chiave configurata, `node tests/smoke.mjs` esegue un piccolo controllo stdio live: handshake, ricerca e lettura, continuazione letterale, pagine indice/atto, risorse/prompt, aggiornamenti ed errori tipizzati. Un disservizio upstream fallisce il controllo; non è mai una prova positiva di assenza. Non sostituisce l'accettazione finale del rilascio.

## Copertura e limitazioni

AKN datato e indirizzi di navigazione sono verificati contro contenuti indipendenti dell'endpoint di dettaglio. Non si inferisce appartenenza storica da navigazione, date radice o conteggi. Conflitti sostanziali impediscono risultati; differenze identificate nelle sole note esplicative sono dichiarate. Le rubriche sono fornite quando disponibili e validate, mai inventate dal titolo di una legge.

Controlla `coverage.article_inventory_complete`, `coverage.legal_content_complete` e riferimenti agli allegati non letti anche con attraversamento `complete`. Grafica/PDF non letti restano visibili e collegati quando la fonte fornisce un link; non vengono interpretati automaticamente né garantiti come link storici. Lettura di prefazione, preambolo e conclusioni priva di controlli indipendenti resta dichiarata fuori copertura supportata. Nessun fallback automatico all'intera storia né cambio di fonte.

Usa `read_act` per tabelle; un articolo con tabelle restituisce unresolved nella lettura testuale diretta con indicazioni per il percorso strutturato. Il testo conserva struttura supportata di modifiche e citazioni. La restituzione non garantisce che un modello esterno riproduca tutte le parole. Vincoli upstream e comportamento dei modelli sono distinti dai difetti verificati del connettore nella [mappa di pianificazione](https://github.com/adellorto/normattiva-mcp/issues/1).

## Licenza

Sorgenti: [MIT](./LICENSE). Contenuti normativi: IPZS [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); gli usi successivi devono attribuire Normattiva / IPZS. Normattiva è un marchio IPZS; il progetto non è affiliato né approvato da IPZS.
