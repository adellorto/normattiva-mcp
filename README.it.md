# normattiva-mcp

[English](./README.md) · **Italiano**

[![Listed in italia-mcp-servers](https://img.shields.io/badge/listed%20in-italia--mcp--servers-blue)](https://github.com/bsab/italia-mcp-servers)

Un server [Model Context Protocol](https://modelcontextprotocol.io) per la normativa italiana ufficiale di [Normattiva](https://www.normattiva.it), gestito da IPZS. Ricerca di atti, indice degli articoli a una data precisa e lettura limitata sono condivisi dai trasporti stdio e Streamable HTTP.

## Stato del rilascio

La versione **0.2.0** è pubblicata e l'endpoint ospitato di produzione è attivo. Il [tag](https://github.com/adellorto/normattiva-mcp/tree/v0.2.0), il [rilascio GitHub](https://github.com/adellorto/normattiva-mcp/releases/tag/v0.2.0), il [pacchetto npm](https://www.npmjs.com/package/normattiva-mcp/v/0.2.0) e l'[endpoint ospitato](https://normattiva-mcp.adellorto.com/api/mcp) espongono la nuova interfaccia coordinata descritta sotto. Il [resoconto della pubblicazione](docs/implementation/release-publication.md) collega questi artefatti pubblici al commit revisionato e registra il controllo di produzione superato dopo il rilascio.

Questa revisione implementa le fasi 1–4 della [specifica accettata](https://github.com/adellorto/normattiva-mcp/issues/6#issuecomment-5992182865). Il [resoconto di accettazione precedente alla pubblicazione](docs/implementation/release-acceptance.md) resta il documento storico delle prove, delle decisioni e delle verifiche ancora in sospeso in quel momento. Le verifiche attuali sui modelli, la guida misurata con tokenizer nativo e l'esclusione approvata di **Llama3.1 8B** dal supporto validato sono registrate nella [correzione della guida ai modelli](docs/implementation/model-guidance-remedy.md). Campioni finiti offline o sui modelli non dimostrano affidabilità arbitraria dei modelli. Dettagli: [lettura validata](docs/implementation/validated-reading.md), [ricerca di atti](docs/implementation/act-discovery.md), [integrazione pubblica](docs/implementation/public-integration.md). La [guida alla migrazione incompatibile](docs/migration.md) elenca campi e chiamate rimossi.

## Funzionalità

### Strumenti

| Strumento | Scopo |
| --- | --- |
| `find_acts` | Prima chiamata per una richiesta di atto o articolo: copia l'intero messaggio dell'utente invariato in `request`, preservando caratteri, istruzioni di lettura e vincoli di data/stato, poi attende il risultato. Restituisce `identified`, `candidates` o `no_candidates`, riferimenti agli atti e intenzione relativa all'articolo separata; mai il testo. Per una pagina successiva senza cursore, lo chiede senza strumenti. Una ricerca vuota non prova assenza; usa i riferimenti ufficiali restituiti senza inventare fonti o URL. |
| `continue_acts` | Continua la ricerca solo con un vero cursore restituito, copiato letteralmente; segnaposto e valori inventati non sono validi. Se manca, non chiama strumenti e lo chiede in una frase breve. I cursori di lettura/indice appartengono allo strumento originale. Il corpus è live; il completamento non prova esaustività giuridica. |
| `list_articles` | Restituisce pagine di occorrenze verificate, rubriche disponibili, gerarchia e riferimenti agli allegati per un `act_locator` a una `snapshot_date` precisa. Continua mediante `list_articles` con solo `cursor` ed eventuale `page_size`, omettendo riferimenti/data originali; per un indice completo già richiesto, continua senza chiedere di nuovo. Valuta la copertura separatamente dall'avanzamento. |
| `read_article` | Legge un `article_locator` esatto già restituito, oppure `act_locator` e `article_reference`, senza indice obbligatorio. Restituisce `found`, `absent` sostenuto da prove, oppure `unresolved` (esistenza ignota). Continua mediante `read_article` con il solo `cursor` letterale ed eventuale `max_chars`; per un articolo completo già richiesto, continua senza chiedere permesso. |
| `read_act` | Legge pagine limitate di testo e celle strutturate da un `act_locator`, eventualmente selezionando un `attachment_ref` elencato. Continua mediante `read_act` con solo `cursor` ed eventuale `max_chars`, omettendo riferimenti/data originali; segue i cursori senza chiedere di nuovo se è stato richiesto l'intero atto. Completamento e copertura del contenuto giuridico sono distinti. |
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

Esegui una sola chiamata di ricerca copiando integralmente la richiesta dell'utente, inclusi articoli/commi, date, vigenza e contraddizioni. Attendi il risultato prima di leggere o cercare ancora; non aggiungere citazioni ricordate, non sostituire l'emanazione con la pubblicazione e non correggere silenziosamente un intervallo invalido. È appropriato anche chiedere chiarimenti su una richiesta invalida.

```json
{"name":"find_acts","arguments":{"request":"decreto legislativo 267/2000 articolo 13"}}
```

Seleziona l'`act_locator` opaco del candidato restituito; non inserire mai una citazione leggibile o un valore ricostruito a memoria in un campo locator. La ricerca separa `article_reference`. Sostituisci il riferimento nell'esempio con il valore effettivo:

```json
{"name":"read_article","arguments":{"act_locator":"<act_locator restituito>","article_reference":"13","snapshot_date":"2026-10-02"}}
```

Per suffissi, atti strutturati o occorrenze ripetute, scegli l'`article_locator` esatto da `list_articles`. Non ricostruire coordinate interne e non scegliere una generazione dalla memoria del modello. `candidates` richiede ancora selezione. Alias controllati e identità verificata live non provano la vigenza attuale: i candidati indicano al momento `current: "unknown"`.

La ricerca prosegue con `continue_acts({cursor})`. Indice e lettura proseguono richiamando lo stesso strumento con `{cursor}` ed eventuale nuovo limite. Tratta ogni cursore come opaco e sensibile alle maiuscole: riusa esattamente la stringa restituita senza ridigitarla, normalizzarla, decodificarla, correggerla o cambiarne le maiuscole, e ometti riferimenti/data originali. `find_acts` e `continue_acts` non espongono un limite pubblico di candidati.

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

Una sola richiesta upstream attiva per processo; scadenza condivisa di 50 secondi, massimo 20 secondi per tentativo, due tentativi per letture dirette o sedici per operazioni composte. I ritentativi richiedono ripetibilità sicura e prove di errore transitorio noto; la continuazione ha un nuovo budget. Client e hosting devono lasciare tempo per restituire la risposta dopo la scadenza; la funzione HTTP consente 60 secondi. La cancellazione interrompe lavoro in coda e attivo in stdio e nello stesso processo HTTP.

## Configurazione e fiducia nei riferimenti

I nuovi server richiedono `NORMATTIVA_REFERENCE_KEY`: esattamente 64 caratteri esadecimali per una chiave di 32 byte generata crittograficamente. Generala **una volta**, poi conservala nell'ambiente del client o nei segreti del deployment:

```bash
openssl rand -hex 32
export NORMATTIVA_REFERENCE_KEY='<incolla la chiave persistente di 64 caratteri hex>'
```

Il server legge l'ambiente del processo; non carica automaticamente `.env`, non crea chiavi e non include un segreto condiviso. Configurazione assente o malformata fallisce esplicitamente. Processi compatibili con la stessa chiave conservata verificano riferimenti firmati dopo riavvio; trasferimenti tra hosting e npm richiedono anche fiducia condivisa e versioni compatibili. Perdere/cambiare chiave invalida riferimenti firmati e richiede nuove ricerche/letture. Deployment con fiducia diversa rifiutano i riferimenti.

Formati: `a1_` riferimenti portabili alla pubblicazione validata (non prove di esistenza); `a2_` riferimenti firmati agli atti con identità restituita indipendentemente dalla ricerca ufficiale; `n2_` riferimenti esatti compatti firmati; `n3_` cursori di lettura firmati composti solo da caratteri minuscoli; `d2_` cursori firmati minuscoli della ricerca live. Questa implementazione legge anche i precedenti riferimenti `n1_`, i cursori di lettura `n2_` e i cursori di ricerca `d1_`. Le implementazioni precedenti rifiutano le nuove versioni, quindi aggiorna entrambe le estremità prima di trasferire riferimenti appena emessi. I cursori minuscoli usano payload raw-DEFLATE autenticati e codificati Base32; il payload decodificato resta limitato a 16 KiB. I cursori compatti condividono il legame allo snapshot del destinatario in un unico payload autenticato. L'identità firmata sopravvive al riavvio e richiede fiducia condivisa per il trasferimento. Le risposte di dettaglio devono confermare indipendentemente quell'identità e l'intervallo di validità richiesto. Riferimenti non supportati/manomessi/non fidati falliscono senza riavvii silenziosi o richieste a host scelti dal chiamante. Nessun database dei cursori.

Le destinazioni sono host ufficiali fissi dell'API e del sito Normattiva in produzione. L'API aperta non richiede autenticazione. L'ambiente PRE con mTLS è escluso.

## Client e HTTP

I client stdio della versione 0.2.0 possono eseguire il pacchetto pubblicato con la chiave persistente:

```json
{
  "mcpServers": {
    "normattiva": {
      "command": "npx",
      "args": ["-y", "normattiva-mcp@0.2.0"],
      "env": { "NORMATTIVA_REFERENCE_KEY": "<chiave persistente di 64 caratteri hex>" }
    }
  }
}
```

L'endpoint ospitato di produzione è `https://normattiva-mcp.adellorto.com/api/mcp`. Gli utenti del servizio ospitato non hanno bisogno di una chiave di riferimento né di autenticazione aggiuntiva; la fiducia del deployment è configurata dal gestore. Copie compatibili ospitate autonomamente espongono gli stessi sei strumenti via Streamable HTTP, con CORS permissivo e senza autenticazione predefinita.

L'inizializzazione HTTP restituisce un `Mcp-Session-Id` opaco; i client devono conservarlo nei POST successivi affinché le notifiche di cancellazione individuino le proprie richieste. Le richieste senza questo header funzionano, ma le loro notifiche non possono cancellare un POST precedente. Il server ferma il lavoro anche quando l'host interrompe il `Request.signal` in ingresso. Questo deployment Vercel abilita per `api/mcp.ts` la consegna documentata della disconnessione downstream con `supportsCancellation`; altri host devono fornire un comportamento equivalente del `Request.signal`. La perdita della connessione provoca pulizia del ciclo di vita, ma non è una notifica MCP esplicita. Il riferimento resta valido dopo riavvii con la chiave di firma conservata, mentre le notifiche raggiungono solo chiamate attive nello stesso processo. Con più istanze servono ancora affinità o instradamento condiviso per notifiche MCP separate; non è garantita la cancellazione tramite notifica tra istanze. Un riferimento di sessione non valido restituisce HTTP 404 e richiede una nuova inizializzazione. Ogni POST contiene un solo messaggio MCP; i batch sono rifiutati. GET e DELETE restituiscono 405; le risposte usano JSON senza stream SSE riprendibile.

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
