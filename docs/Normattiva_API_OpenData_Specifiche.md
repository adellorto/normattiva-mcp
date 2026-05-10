# Normattiva — Specifiche API Open Data

**Documento:** MDL-ITSMS-00-GEN REV00
**Data:** 09/01/2025
**Classificazione:** interno
**Editore:** Poligrafico e Zecca dello Stato Italiano (IPZS)

---

## Revision History

| Versione | Data | Modifiche | Autore | Direzione/Struttura |
|---|---|---|---|---|
| 00 | 13.12.2024 | Prima revisione | IPZS | IT |
| 01 | 06/02/2025 | Seconda revisione | IPZS | IT |
| 02 | 12/02/2025 | Terza revisione | IPZS | IT |
| 03 | 09/05/2025 | Quarta revisione per integrazione API di visualizzazione dettaglio atto, API atti modificati tra due date, download zip ricerca e collezione preconfezionata (par. 1.3.6, 1.3.7, 1.3.8) e risposte in caso di errore (par. 1.3.10) | IPZS | IT |
| 04 | 26/05/2025 | Quinta revisione – correzione refusi | IPZS | IT |
| 05 | 09/06/2025 | Sesta revisione – aggiunti codici d'errore per formati di download non validi, aggiunti ulteriori due campi nella risposta all'invocazione dell'API "RicercaAttiAggiornati" e aggiunti ulteriori due codici d'errore inerenti al periodo massimo richiesto in ingresso e alla dimensione dei risultati di ricerca. | IPZS | IT |
| 06 | 18/06/2025 | Aggiunto il codice di risposta 1503 (nel caso di intervallo temporale incoerente) relativo al seguente endpoint: `bff-opendata/v1/api/v1/ricerca/aggiornati` | IPZS | IT |
| 07 | 03/09/2025 | Aggiunti i seguenti 4 parametri: `annoProvvedimento`, `giornoProvvedimento`, `meseProvvedimento`, `numeroProvvedimento` al request body del seguente endpoint: `bff-opendata/v1/api/v1/ricerca/avanzata`. Impostati come opzionali i seguenti 2 parametri: `modalita`, `email` del request body del seguente endpoint: `/bff-opendata/v1/api/v1/ricerca-asincrona/nuova-ricerca` | IPZS | IT |
| 08 | 30/10/2025 | API Download collezione preconfezionata - miglioramento codici d'errore | IPZS | IT |

---

## Sommario

1. [Specifica delle API Open Data](#1-specifica-delle-api-open-data)
   - 1.1 [Indirizzi](#11-indirizzi)
   - 1.2 [Tipologiche](#12-tipologiche)
     - 1.2.1 [Estensioni (formati di esportazione)](#121-estensioni-formati-di-esportazione)
     - 1.2.2 [Collezioni predefinite](#122-collezioni-predefinite)
     - 1.2.3 [Ricerche Predefinite](#123-ricerche-predefinite)
     - 1.2.4 [Classe Provvedimento](#124-classe-provvedimento)
     - 1.2.5 [Denominazione atto](#125-denominazione-atto)
   - 1.3 [API di ricerca](#13-api-di-ricerca)
     - 1.3.1 [Ricerca Semplice](#131-ricerca-semplice)
     - 1.3.2 [Ricerca Avanzata](#132-ricerca-avanzata)
     - 1.3.3 [Ricerca Semplice o avanzata con FacetMap](#133-ricerca-semplice-o-avanzata-con-facetmap)
     - 1.3.4 [Inserimento richiesta export](#134-inserimento-richiesta-export)
     - 1.3.5 [Conferma ricerca](#135-conferma-ricerca)
     - 1.3.6 [Download Ricerca](#136-download-ricerca)
     - 1.3.7 [Visualizzazione dettaglio atto](#137-visualizzazione-dettaglio-atto)
     - 1.3.8 [Download collezione preconfezionata](#138-download-collezione-preconfezionata)
     - 1.3.9 [Ricerca Atti aggiornati](#139-ricerca-atti-aggiornati)
     - 1.3.10 [Risposta in caso di errore](#1310-risposta-in-caso-di-errore)
2. [Appendice](#2-appendice)
   - 2.1.1 [Configurazione tool "Postman" con esempi chiamate](#211-configurazione-tool-postman-con-esempi-chiamate)

---

# 1. Specifica delle API Open Data

## 1.1 Indirizzi

L'indirizzo completo URL a cui raggiungere le varie API si ottiene giustapponendo un suffisso proprio di ciascuna API ai seguenti indirizzi, in funzione dell'ambiente target. Nel dettaglio:

- **Ambiente di esercizio:** `https://api.normattiva.it/t/normattiva.api`
- **Ambiente di test (PRE):** `https://pre.api.normattiva.it/t/normattiva.api`

---

## 1.2 Tipologiche

### 1.2.1 Estensioni (formati di esportazione)

**Suffisso URL:** `/bff-opendata/v1/api/v1/tipologiche/estensioni`

**Descrizione Servizio:** Recupero elenco tipologie di formati di esportazione previsti per le collezioni di atti. Questa tipologia di richiesta è necessaria per conoscere tutte le tipologie di formati di esportazione disponibili. La lista è necessaria per valorizzare la proprietà *"formato"* come input di richieste alle API di tipo asincrono che saranno descritte nel seguito del presente documento.

**Esempio chiamata:**

```bash
curl 'https://pre.api.normattiva.it/t/normattiva.api/bff-opendata/v1/api/v1/tipologiche/estensioni' \
  -H 'Accept: application/json, text/plain, */*' \
  -H 'Accept-Language: it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7' \
  -H 'Connection: keep-alive' \
  -H 'Origin: https://pre.dati.normattiva.it' \
  -H 'Sec-Fetch-Dest: empty' \
  -H 'Sec-Fetch-Mode: cors' \
  -H 'Sec-Fetch-Site: same-site' \
  -H 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36' \
  -H 'sec-ch-ua: "Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"' \
  -H 'sec-ch-ua-mobile: ?0' \
  -H 'sec-ch-ua-platform: "Windows"'
```

**Esempio response:**

```json
[
  { "label": "AKN",  "value": "Esporta AKN" },
  { "label": "XML",  "value": "Esporta XML" },
  { "label": "PDF",  "value": "Esporta PDF" },
  { "label": "EPUB", "value": "Esporta EPUB" },
  { "label": "RTF",  "value": "Esporta RTF" },
  { "label": "URI",  "value": "Esporta ELI" },
  { "label": "JSON", "value": "Esporta JSON" }
]
```

**Codici di risposta:**

| Codice (HTTP) | Descrizione | Formato | Esempio Response Body |
|---|---|---|---|
| 200 | Richiesta elaborata e risultati estratti con successo | JSON | Vedere contenuto response riportato sopra |
| 404 | Risorsa non trovata o non correttamente specificata | JSON | `{ "code": "404", "type": "Status report", "message": "Runtime Error", "description": "No matching resource found for given API Request" }` |
| 500 | Errore interno del server | JSON | `{ "message": "Errore generico della chiamata, riprovare più tardi", "code": "500" }` |

---

### 1.2.2 Collezioni predefinite

**Suffisso URL:** `/bff-opendata/v1/api/v1/collections/collection-predefinite`

**Descrizione:** Recupero elenco nomi delle collezioni di atti esistenti. Saranno presenti una serie di collezioni preconfezionate per tipologia, area tematica, argomento, o altre caratteristiche per cui è stata predisposta una collezione di atti. La richiesta che segue fornisce al client la lista esaustiva di ciò che è già disponibile e scaricabile. In questo caso non è previsto nessun parametro in input.

**Esempio chiamata:**

```bash
curl 'https://pre.api.normattiva.it/t/normattiva.api/bff-opendata/v1/api/v1/collections/collection-predefinite' \
  -H 'Accept: application/json, text/plain, */*' \
  -H 'Accept-Language: it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7' \
  -H 'Connection: keep-alive' \
  -H 'Origin: https://pre.dati.normattiva.it' \
  -H 'Sec-Fetch-Dest: empty' \
  -H 'Sec-Fetch-Mode: cors' \
  -H 'Sec-Fetch-Site: same-site' \
  -H 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36' \
  -H 'sec-ch-ua: "Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"' \
  -H 'sec-ch-ua-mobile: ?0' \
  -H 'sec-ch-ua-platform: "Windows"'
```

**Esempio response:**

```json
[
  {
    "nomeCollezione": "ATTI in MULTIVIGENZA ultimi 5 anni",
    "numeroAtti": 483
  },
  {
    "nomeCollezione": "Atti vigenti ad oggi",
    "numeroAtti": 1284
  }
]
```

**Codici di risposta:**

| Codice (HTTP) | Descrizione | Formato | Esempio Response Body |
|---|---|---|---|
| 200 | Richiesta elaborata e risultati estratti con successo | JSON | Vedere contenuto response riportato sopra |
| 404 | Risorsa non trovata o non correttamente specificata | JSON | `{ "code": "404", "type": "Status report", "message": "Runtime Error", "description": "No matching resource found for given API Request" }` |
| 500 | Errore interno del server | JSON | `{ "message": "Errore generico della chiamata, riprovare più tardi", "code": "500" }` |

---

### 1.2.3 Ricerche Predefinite

**Suffisso URL:** `/bff-opendata/v1/api/v1/ricerca/predefinita`

**Descrizione:** Ricerche predefinite sulla base di parametri preimpostati, presenti nel form di ricerca sul portale Normattiva OpenData.

**Esempio chiamata:**

```bash
curl 'https://pre.api.normattiva.it/t/normattiva.api/bff-opendata/v1/api/v1/ricerca/predefinita' \
  -H 'Accept: application/json, text/plain, */*' \
  -H 'Accept-Language: it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7' \
  -H 'Connection: keep-alive' \
  -H 'Origin: https://pre.dati.normattiva.it' \
  -H 'Sec-Fetch-Dest: empty' \
  -H 'Sec-Fetch-Mode: cors' \
  -H 'Sec-Fetch-Site: same-site' \
  -H 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36' \
  -H 'sec-ch-ua: "Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"' \
  -H 'sec-ch-ua-mobile: ?0' \
  -H 'sec-ch-ua-platform: "Windows"'
```

**Esempio response:**

```json
{
  "ricerchePredefinite": [
    {
      "nome": "Atti Repubblica",
      "dettagli": [
        { "nomeCampo": "EmanazioneFrom", "valoreCampo": "1946-06-20" },
        { "nomeCampo": "EmanazioneTo",   "valoreCampo": "2024-12-19" }
      ],
      "dataCreazione": "2024-12-17T20:23:02"
    },
    {
      "nome": "Atti Regno d'Italia aggiornati vigenti",
      "dettagli": [
        { "nomeCampo": "EmanazioneFrom",       "valoreCampo": "1861-01-01" },
        { "nomeCampo": "EmanazioneTo",         "valoreCampo": "1946-06-10" },
        { "nomeCampo": "classeProvvedimento",  "valoreCampo": "2" }
      ],
      "dataCreazione": "2024-12-17T20:23:02"
    },
    {
      "nome": "Atti abrogati",
      "dettagli": [
        { "nomeCampo": "classeProvvedimento", "valoreCampo": "3" }
      ],
      "dataCreazione": "2024-12-17T20:23:03"
    },
    {
      "nome": "Atti in formato originario",
      "dettagli": [
        { "nomeCampo": "PubblicazioneFrom", "valoreCampo": "2010-01-01" },
        { "nomeCampo": "PubblicazioneTo",   "valoreCampo": "2024-12-19" }
      ],
      "dataCreazione": "2024-12-18T18:01:16"
    }
  ]
}
```

**Codici di risposta:**

| Codice (HTTP) | Descrizione | Formato | Esempio Response Body |
|---|---|---|---|
| 200 | Richiesta elaborata e risultati estratti con successo | JSON | Vedere contenuto response riportato sopra |
| 404 | Risorsa non trovata o non correttamente specificata | JSON | `{ "code": "404", "type": "Status report", "message": "Runtime Error", "description": "No matching resource found for given API Request" }` |
| 500 | Errore interno del server | JSON | `{ "message": "Errore generico della chiamata, riprovare più tardi", "code": "500" }` |

---

### 1.2.4 Classe Provvedimento

**Suffisso URL:** `/bff-opendata/v1/api/v1/tipologiche/classe-provvedimento`

**Descrizione:** Recupero elenco classi di provvedimento gestite dal portale Normattiva OpenData. Questa tipologia di richiesta è necessaria per conoscere tutte le classi di provvedimento disponibili in base dati. La lista è necessaria per valorizzare la proprietà *"classeProvvedimento"* come input di richieste alle API di tipo asincrono che saranno descritte nel seguito.

**Esempio chiamata:**

```bash
curl 'https://pre.api.normattiva.it/t/normattiva.api/bff-opendata/v1/api/v1/tipologiche/classe-provvedimento' \
  -H 'Accept: application/json, text/plain, */*' \
  -H 'Accept-Language: it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7' \
  -H 'Connection: keep-alive' \
  -H 'Origin: https://pre.dati.normattiva.it' \
  -H 'Sec-Fetch-Dest: empty' \
  -H 'Sec-Fetch-Mode: cors' \
  -H 'Sec-Fetch-Site: same-site' \
  -H 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36' \
  -H 'sec-ch-ua: "Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"' \
  -H 'sec-ch-ua-mobile: ?0' \
  -H 'sec-ch-ua-platform: "Windows"'
```

**Esempio response:**

```json
[
  { "label": "1", "value": "atto normativo – senza aggiornamenti" },
  { "label": "2", "value": "atto normativo – aggiornato" },
  { "label": "3", "value": "atto normativo – abrogato" }
]
```

**Codici di risposta:**

| Codice (HTTP) | Descrizione | Formato | Esempio Response Body |
|---|---|---|---|
| 200 | Richiesta elaborata e risultati estratti con successo | JSON | Vedere contenuto response riportato sopra |
| 404 | Risorsa non trovata o non correttamente specificata | JSON | `{ "code": "404", "type": "Status report", "message": "Runtime Error", "description": "No matching resource found for given API Request" }` |
| 500 | Errore interno del server | JSON | `{ "message": "Errore generico della chiamata, riprovare più tardi", "code": "500" }` |

---

### 1.2.5 Denominazione atto

**Suffisso URL:** `/bff-opendata/v1/api/v1/tipologiche/denominazione-atto`

**Descrizione:** Recupero elenco tipologie di provvedimento di atti. Questa tipologia di richiesta è necessaria per conoscere tutte le tipologie di atti disponibili in base dati. La lista è necessaria per valorizzare la proprietà *"codice_tipo_provvedimento"* come input di richieste alle API di tipo asincrono che saranno descritte nel seguito.

**Esempio chiamata:**

```bash
curl 'https://pre.api.normattiva.it/t/normattiva.api/bff-opendata/v1/api/v1/tipologiche/denominazione-atto' \
  -H 'Accept: application/json, text/plain, */*' \
  -H 'Accept-Language: it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7' \
  -H 'Connection: keep-alive' \
  -H 'Origin: https://pre.dati.normattiva.it' \
  -H 'Sec-Fetch-Dest: empty' \
  -H 'Sec-Fetch-Mode: cors' \
  -H 'Sec-Fetch-Site: same-site' \
  -H 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36' \
  -H 'sec-ch-ua: "Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"' \
  -H 'sec-ch-ua-mobile: ?0' \
  -H 'sec-ch-ua-platform: "Windows"'
```

**Esempio response:**

```json
[
  { "label": "COS",     "value": "COSTITUZIONE" },
  { "label": "DCT",     "value": "DECRETO" },
  { "label": "PCG",     "value": "DECRETO DEL CAPO DEL GOVERNO" },
  { "label": "3NA",     "value": "DECRETO DEL CAPO DEL GOVERNO, PRIMO MINISTRO SEGRETARIO DI STATO" },
  { "label": "PCS",     "value": "DECRETO DEL CAPO PROVVISORIO DELLO STATO" },
  { "label": "DDD",     "value": "DECRETO DEL DUCE" },
  { "label": "FAC",     "value": "DECRETO DEL DUCE DEL FASCISMO, CAPO DEL GOVERNO" },
  { "label": "PCM_DPC", "value": "DECRETO DEL PRESIDENTE DEL CONSIGLIO DEI MINISTRI" },
  { "label": "PPR",     "value": "DECRETO DEL PRESIDENTE DELLA REPUBBLICA" },
  { "label": "PDL",     "value": "DECRETO-LEGGE" },
  { "label": "DLL",     "value": "DECRETO-LEGGE LUOGOTENENZIALE" },
  { "label": "PLL",     "value": "DECRETO LEGISLATIVO" },
  { "label": "DCS",     "value": "DECRETO LEGISLATIVO DEL CAPO PROVVISORIO DELLO STATO" },
  { "label": "PLG",     "value": "DECRETO LEGISLATIVO LUOGOTENENZIALE" },
  { "label": "PZP",     "value": "DECRETO LEGISLATIVO PRESIDENZIALE" },
  { "label": "PLU",     "value": "DECRETO LUOGOTENENZIALE" },
  { "label": "PDM",     "value": "DECRETO MINISTERIALE" },
  { "label": "DPP",     "value": "DECRETO PRESIDENZIALE" },
  { "label": "SNI",     "value": "DECRETO REALE" },
  { "label": "DEL",     "value": "DELIBERAZIONE" },
  { "label": "GRC",     "value": "DETERMINAZIONE DEL COMMISSARIO PER LE FINANZE" },
  { "label": "DPB",     "value": "DETERMINAZIONE DEL COMMISSARIO PER LA PRODUZIONE BELLICA" },
  { "label": "8ZL",     "value": "DETERMINAZIONE INTERCOMMISSARIALE" },
  { "label": "PLE",     "value": "LEGGE" },
  { "label": "PLC",     "value": "LEGGE COSTITUZIONALE" },
  { "label": "POR",     "value": "ORDINANZA" },
  { "label": "PRD",     "value": "REGIO DECRETO" },
  { "label": "PRL",     "value": "REGIO DECRETO-LEGGE" },
  { "label": "RDL",     "value": "REGIO DECRETO LEGISLATIVO" },
  { "label": "D10",     "value": "REGOLAMENTO" }
]
```

**Codici di risposta:**

| Codice (HTTP) | Descrizione | Formato | Esempio Response Body |
|---|---|---|---|
| 200 | Richiesta elaborata e risultati estratti con successo | JSON | Vedere contenuto response riportato sopra |
| 404 | Risorsa non trovata o non correttamente specificata | JSON | `{ "code": "404", "type": "Status report", "message": "Runtime Error", "description": "No matching resource found for given API Request" }` |
| 500 | Errore interno del server | JSON | `{ "message": "Errore generico della chiamata, riprovare più tardi", "code": "500" }` |

---

## 1.3 API di ricerca

### 1.3.1 Ricerca Semplice

**Suffisso URL:** `/bff-opendata/v1/api/v1/ricerca/semplice`

**Descrizione:** Richiesta esportazione di una collezione di atti sulla base di determinati criteri di ricerca. Si tratta dell'API che ricalca il form di ricerca semplice del portale Normattiva. Questa API può consentire di esportare:

- Una collezione di atti sulla base dei criteri immessi esportando gli atti nel formato prescelto
- Individuare ed esportare un singolo atto nel formato prescelto
- Ottenere le meta informazioni, i riferimenti e le chiavi di individuazione della collezione di atti

Richiedendo l'esportazione dei soli metadati si otterrà una lista di atti che non conterrà il contenuto testuale dei singoli provvedimenti ma permetterà di richiedere selettivamente informazioni sui singoli atti utilizzando un'ulteriore chiamata ad un'altra API asincrona.

**Input previsti:**

- `testoRicerca`: parole ricercate nel titolo e/o testo (keywords ad inserimento libero - "buca di ricerca")
- `orderType`: ordine di restituzione dei risultati di ricerca, dal meno recente al più recente o viceversa (valori ammissibili: `"recente"` oppure `"vecchio"`)
- `paginaCorrente`: numero di pagina di interesse contenente il blocco di risultati di ricerca
- `numeroElementiPerPagina`: numero totale di risultati di ricerca restituiti all'interno della pagina corrente richiesta

**Esempio chiamata:**

```bash
curl 'https://pre.api.normattiva.it/t/normattiva.api/bff-opendata/v1/api/v1/ricerca/semplice' \
  -H 'Accept: application/json, text/plain, */*' \
  -H 'Accept-Language: it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7' \
  -H 'Connection: keep-alive' \
  -H 'Content-Type: application/json' \
  -H 'Origin: https://pre.dati.normattiva.it' \
  -H 'Sec-Fetch-Dest: empty' \
  -H 'Sec-Fetch-Mode: cors' \
  -H 'Sec-Fetch-Site: same-site' \
  -H 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36' \
  -H 'sec-ch-ua: "Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"' \
  -H 'sec-ch-ua-mobile: ?0' \
  -H 'sec-ch-ua-platform: "Windows"' \
  --data-raw '{"testoRicerca":"provvedimento","orderType":"recente","paginazione":{"paginaCorrente":1,"numeroElementiPerPagina":10}}'
```

**Esempio response (estratto — ulteriori elementi `listaAtti` omessi per brevità; struttura ripetuta per ciascun atto):**

```json
{
  "listaAtti": [
    {
      "numeroAtto": "209",
      "numeroAttoAlfanumerico": "209",
      "dataGU": "2024-12-31",
      "numeroGU": "305",
      "codiceRedazionale": "24G00231",
      "titoloAtto": "[Disposizioni integrative e correttive al codice dei contratti pubblici, di cui al decreto legislativo 31 marzo 2023, n. 36. (24G00231) ]",
      "giornoProvvedimento": "31",
      "meseProvvedimento": "12",
      "meseProvvedimentoIta": "dicembre",
      "meseProvvedimentoEng": "December",
      "annoProvvedimento": "2024",
      "numeroProvvedimento": "209",
      "denominazioneAtto": "DECRETO LEGISLATIVO",
      "numeroSupplemento": "45",
      "tipoSupplemento": "SO",
      "suffissoArticoloSelezionato": 1,
      "subArt1ArticoloSelezionato": 0,
      "hlTitoli": null,
      "hlArticoli": null,
      "annoDataGU": "2024",
      "dataGUStr": "31-12-2024",
      "tipoSupplementoIt": " - Suppl. Ordinario n. 45",
      "tipoSupplementoEn": " - Ordinary Suppl. n. 45",
      "dataEmanazione": "2024-12-31T00:00:00Z",
      "descrizioneAtto": "DECRETO LEGISLATIVO 31 dicembre 2024, n. 209"
    }
    // ... ulteriori atti con la medesima struttura (DECRETO-LEGGE n. 208, LEGGE n. 207,
    //     DECRETO n. 206, LEGGE n. 203, DECRETO-LEGGE n. 202, DECRETO-LEGGE n. 201,
    //     DECRETO n. 197, DECRETO n. 194, LEGGE n. 193, ...)
  ],
  "facetMap": {
    "anno_provvedimento": [
      { "codice": "2021", "valore": 174, "descrizione": "2021" },
      { "codice": "2023", "valore": 165, "descrizione": "2023" },
      { "codice": "2022", "valore": 161, "descrizione": "2022" },
      { "codice": "2024", "valore": 154, "descrizione": "2024" },
      { "codice": "2019", "valore": 139, "descrizione": "2019" },
      { "codice": "2020", "valore": 132, "descrizione": "2020" },
      { "codice": "2018", "valore": 6,   "descrizione": "2018" }
    ],
    "codice_tipo_provvedimento": [
      { "codice": "PLE",     "valore": 349, "descrizione": "LEGGE" },
      { "codice": "PDL",     "valore": 179, "descrizione": "DECRETO-LEGGE" },
      { "codice": "PLL",     "valore": 154, "descrizione": "DECRETO LEGISLATIVO" },
      { "codice": "DCT",     "valore": 149, "descrizione": "DECRETO" },
      { "codice": "PCM_DPC", "valore": 67,  "descrizione": null },
      { "codice": "PPR",     "valore": 33,  "descrizione": "DECRETO DEL PRESIDENTE DELLA REPUBBLICA" }
    ],
    "descrizione_emettitore": [
      { "codice": "---", "valore": 782, "descrizione": "STATO" },
      { "codice": "MINISTERO DELL'ECONOMIA E DELLE FINANZE", "valore": 20, "descrizione": "MINISTERO DELL'ECONOMIA E DELLE FINANZE" },
      { "codice": "MINISTERO DELL'INTERNO", "valore": 18, "descrizione": "MINISTERO DELL'INTERNO" },
      { "codice": "MINISTERO DELLA GIUSTIZIA", "valore": 17, "descrizione": "MINISTERO DELLA GIUSTIZIA" },
      { "codice": "MINISTERO DELLA SALUTE", "valore": 17, "descrizione": "MINISTERO DELLA SALUTE" },
      { "codice": "MINISTERO DELLE INFRASTRUTTURE E DEI TRASPORTI", "valore": 15, "descrizione": "MINISTERO DELLE INFRASTRUTTURE E DEI TRASPORTI" },
      { "codice": "MINISTERO DELLO SVILUPPO ECONOMICO", "valore": 7, "descrizione": "MINISTERO DELLO SVILUPPO ECONOMICO" },
      { "codice": "MINISTERO DEL LAVORO E DELLE POLITICHE SOCIALI", "valore": 6, "descrizione": "MINISTERO DEL LAVORO E DELLE POLITICHE SOCIALI" },
      { "codice": "MINISTERO DELL'AMBIENTE E DELLA TUTELA DEL TERRITORIO E DEL MARE", "valore": 6, "descrizione": "MINISTERO DELL'AMBIENTE E DELLA TUTELA DEL TERRITORIO E DEL MARE" },
      { "codice": "MINISTERO DELLE INFRASTRUTTURE E DELLA MOBILITA' SOSTENIBILI", "valore": 6, "descrizione": "MINISTERO DELLE INFRASTRUTTURE E DELLA MOBILITA' SOSTENIBILI" },
      { "codice": "MINISTERO DELL'AMBIENTE E DELLA SICUREZZA ENERGETICA", "valore": 4, "descrizione": "MINISTERO DELL'AMBIENTE E DELLA SICUREZZA ENERGETICA" },
      { "codice": "MINISTERO DELLA CULTURA", "valore": 4, "descrizione": "MINISTERO DELLA CULTURA" },
      { "codice": "MINISTERO DELLE IMPRESE E DEL MADE IN ITALY", "valore": 4, "descrizione": "MINISTERO DELLE IMPRESE E DEL MADE IN ITALY" },
      { "codice": "MINISTERO DEL TURISMO", "valore": 3, "descrizione": "MINISTERO DEL TURISMO" },
      { "codice": "MINISTERO DELLA DIFESA", "valore": 3, "descrizione": "MINISTERO DELLA DIFESA" },
      { "codice": "MINISTERO DEGLI AFFARI ESTERI E DELLA COOPERAZIONE INTERNAZIONALE", "valore": 2, "descrizione": "MINISTERO DEGLI AFFARI ESTERI E DELLA COOPERAZIONE INTERNAZIONALE" },
      { "codice": "MINISTERO DELL'ISTRUZIONE", "valore": 2, "descrizione": "MINISTERO DELL'ISTRUZIONE" },
      { "codice": "MINISTERO DELL'UNIVERSITA' E DELLA RICERCA", "valore": 2, "descrizione": "MINISTERO DELL'UNIVERSITA' E DELLA RICERCA" },
      { "codice": "MINISTERO DELLA TRANSIZIONE ECOLOGICA", "valore": 2, "descrizione": "MINISTERO DELLA TRANSIZIONE ECOLOGICA" },
      { "codice": "MINISTERO PER I BENI E LE ATTIVITA' CULTURALI E PER IL TURISMO", "valore": 2, "descrizione": "MINISTERO PER I BENI E LE ATTIVITA' CULTURALI E PER IL TURISMO" },
      { "codice": "PRESIDENZA DEL CONSIGLIO DEI MINISTRI DIPARTIMENTO DELLA FUNZIONE PUBBLICA", "valore": 2, "descrizione": "PRESIDENZA DEL CONSIGLIO DEI MINISTRI DIPARTIMENTO DELLA FUNZIONE PUBBLICA" },
      { "codice": "MINISTERO DELL'ISTRUZIONE E DEL MERITO", "valore": 1, "descrizione": "MINISTERO DELL'ISTRUZIONE E DEL MERITO" },
      { "codice": "MINISTERO DELL'ISTRUZIONE, DELL'UNIVERSITA' E DELLA RICERCA", "valore": 1, "descrizione": "MINISTERO DELL'ISTRUZIONE, DELL'UNIVERSITA' E DELLA RICERCA" },
      { "codice": "MINISTERO PER I BENI E LE ATTIVITA' CULTURALI", "valore": 1, "descrizione": "MINISTERO PER I BENI E LE ATTIVITA' CULTURALI" },
      { "codice": "PRESIDENZA DEL CONSIGLIO DEI MINISTRI", "valore": 1, "descrizione": "PRESIDENZA DEL CONSIGLIO DEI MINISTRI" },
      { "codice": "PRESIDENZA DEL CONSIGLIO DEI MINISTRI - DIPARTIMENTO PER LA TRASFORMAZIONE DIGITALE", "valore": 1, "descrizione": "PRESIDENZA DEL CONSIGLIO DEI MINISTRI - DIPARTIMENTO PER LA TRASFORMAZIONE DIGITALE" },
      { "codice": "PRESIDENZA DEL CONSIGLIO DEI MINISTRI - DIPARTIMENTO PER LE POLITICHE DI COESIONE", "valore": 1, "descrizione": "PRESIDENZA DEL CONSIGLIO DEI MINISTRI - DIPARTIMENTO PER LE POLITICHE DI COESIONE" },
      { "codice": "PRESIDENZA DEL CONSIGLIO DEI MINISTRI - DIPARTIMENTO PER LE POLITICHE IN FAVORE DELLE PERSONE CON DISABILITA'", "valore": 1, "descrizione": "PRESIDENZA DEL CONSIGLIO DEI MINISTRI - DIPARTIMENTO PER LE POLITICHE IN FAVORE DELLE PERSONE CON DISABILITA'" }
    ]
  },
  "numeroPagine": 94,
  "numeroAttiTrovati": 931,
  "paginaCorrente": 1,
  "numeroElementiPerPagina": 0
}
```

**Codici di risposta:**

| Codice (HTTP) | Descrizione | Formato | Esempio Response Body |
|---|---|---|---|
| 200 | Richiesta elaborata e risultati estratti con successo | JSON | Vedere contenuto response riportato sopra |
| 400 | Richiesta mal formata / Input non valido | JSON | `{ "timestamp": "2025-05-08T07:57:26.329+00:00", "status": 400, "error": "Bad Request", "path": "/bff-opendata/api/v1/ricerca/semplice" }` |
| 404 | Risorsa non trovata o non correttamente specificata | JSON | `{ "code": "404", "type": "Status report", "message": "Runtime Error", "description": "No matching resource found for given API Request" }` |
| 500 | Errore interno del server | JSON | `{ "message": "Errore generico della chiamata, riprovare più tardi", "code": "500" }` |

---

### 1.3.2 Ricerca Avanzata

**Suffisso URL:** `/bff-opendata/v1/api/v1/ricerca/avanzata`

**Descrizione:** Richiesta esportazione di una collezione di atti sulla base di determinati criteri di ricerca. Si tratta dell'API che ricalca il form di ricerca avanzata del portale Normattiva. Questa API può consentire di esportare:

- Una collezione di atti sulla base dei criteri immessi esportando gli atti nel formato prescelto
- Ottenere le meta informazioni, i riferimenti e le chiavi di individuazione della collezione di atti

Richiedendo l'esportazione dei soli metadati si otterrà una lista di atti che non conterrà il contenuto testuale dei singoli provvedimenti ma permetterà di richiedere selettivamente informazioni sui singoli atti utilizzando un'ulteriore chiamata ad un'altra API asincrona.

**Input previsti:**

- `denominazioneAtto`: tipo di atto (ad es. DECRETO, COSTITUZIONE, ecc.)
- `titoloRicerca`: parole ricercate nel titolo (ad inserimento libero)
- `dataInizioEmanazione`: data di emanazione a partire da (default = data doc più vecchi), nel formato `YYYY-MM-DD`
- `dataFineEmanazione`: data di emanazione fino a (default = data doc più recenti)
- `dataInizioPubProvvedimento`: data di pubblicazione a partire da (default = data doc più vecchi), nel formato `YYYY-MM-DD`
- `dataFinePubProvvedimento`: data di pubblicazione fino a (default = data doc più recenti), nel formato `YYYY-MM-DD`
- `vigenza`: data di vigenza di interesse, nel formato `YYYY-MM-DD`
- `classeProvvedimento`: identificativo della tipologica della classe di provvedimento recuperata con l'API di cui al par. 1.2.4 Classe Provvedimento
- `testoRicerca`: parole ricercate nel testo (keywords ad inserimento libero - "buca di ricerca")
- `orderType`: ordine di restituzione dei risultati di ricerca (valori: `"recente"` oppure `"vecchio"`)
- `paginaCorrente`: numero di pagina di interesse contenente il blocco di risultati di ricerca
- `numeroElementiPerPagina`: numero totale di risultati di ricerca restituiti all'interno della pagina corrente richiesta
- `annoProvvedimento`: anno di emanazione del provvedimento
- `giornoProvvedimento`: giorno di emanazione del provvedimento
- `meseProvvedimento`: mese di emanazione del provvedimento
- `numeroProvvedimento`: numero del provvedimento

**Esempio chiamata:**

```bash
curl 'https://pre.api.normattiva.it/t/normattiva.api/bff-opendata/v1/api/v1/ricerca/avanzata' \
  -H 'Accept: application/json, text/plain, */*' \
  -H 'Accept-Language: it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7' \
  -H 'Connection: keep-alive' \
  -H 'Content-Type: application/json' \
  -H 'Origin: https://pre.dati.normattiva.it' \
  -H 'Sec-Fetch-Dest: empty' \
  -H 'Sec-Fetch-Mode: cors' \
  -H 'Sec-Fetch-Site: same-site' \
  -H 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36' \
  -H 'sec-ch-ua: "Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"' \
  -H 'sec-ch-ua-mobile: ?0' \
  -H 'sec-ch-ua-platform: "Windows"' \
  --data-raw '{"denominazioneAtto":"DECRETO","orderType":"recente","titoloRicerca":"legge","testoRicerca":"ministro","dataInizioEmanazione":"2023-01-01","dataFineEmanazione":"2023-12-31","dataInizioPubProvvedimento":"2023-01-01","dataFinePubProvvedimento":"2023-12-31","vigenza":"2025-01-09","classeProvvedimento":"2","paginazione":{"paginaCorrente":1,"numeroElementiPerPagina":10}}'
```

**Esempio response:**

```json
{
  "listaAtti": [
    {
      "numeroAtto": "217",
      "numeroAttoAlfanumerico": "217",
      "dataGU": "2023-12-30",
      "numeroGU": "303",
      "codiceRedazionale": "23G00224",
      "titoloAtto": "[Regolamento recante: «Decreto ai sensi dell'articolo 87, commi 1 e 3 del decreto legislativo 10 ottobre 2022, n. 150 e dell'articolo 4, comma 1 del decreto-legge 29 dicembre 2009, n. 193, convertito con modificazioni dalla legge 22 febbraio 2010, n. 24, recante modifiche al decreto del Ministro della giustizia di concerto con il Ministro per la pubblica amministrazione e l'innovazione 21 febbraio 2011, n. 44». (23G00224) ]",
      "giornoProvvedimento": "29",
      "meseProvvedimento": "12",
      "meseProvvedimentoIta": "dicembre",
      "meseProvvedimentoEng": "December",
      "annoProvvedimento": "2023",
      "numeroProvvedimento": "217",
      "denominazioneAtto": "DECRETO",
      "numeroSupplemento": "0",
      "tipoSupplemento": "NO",
      "suffissoArticoloSelezionato": 1,
      "subArt1ArticoloSelezionato": 0,
      "hlTitoli": null,
      "hlArticoli": null,
      "annoDataGU": "2023",
      "dataGUStr": "30-12-2023",
      "tipoSupplementoIt": "",
      "tipoSupplementoEn": "",
      "dataEmanazione": "2023-12-29T00:00:00Z",
      "descrizioneAtto": "DECRETO 29 dicembre 2023, n. 217"
    },
    {
      "numeroAtto": "150",
      "numeroAttoAlfanumerico": "150",
      "dataGU": "2023-10-31",
      "numeroGU": "255",
      "codiceRedazionale": "23G00163",
      "titoloAtto": "[Regolamento recante la determinazione dei criteri e delle modalita' di iscrizione e tenuta del registro degli organismi di mediazione e dell'elenco degli enti di formazione, nonche' l'approvazione delle indennita' spettanti agli organismi, ai sensi dell'articolo 16 del decreto legislativo 4 marzo 2010, n. 28 e l'istituzione dell'elenco degli organismi ADR deputati a gestire le controversie nazionali e transfrontaliere, nonche' il procedimento per l'iscrizione degli organismi ADR ai sensi dell'articolo 141-decies del decreto legislativo 6 settembre 2005, n. 206 recante Codice del consumo, a norma dell'articolo 7 della legge 29 luglio 2003, n. 229. (23G00163) ]",
      "giornoProvvedimento": "24",
      "meseProvvedimento": "10",
      "meseProvvedimentoIta": "ottobre",
      "meseProvvedimentoEng": "October",
      "annoProvvedimento": "2023",
      "numeroProvvedimento": "150",
      "denominazioneAtto": "DECRETO",
      "numeroSupplemento": "0",
      "tipoSupplemento": "NO",
      "suffissoArticoloSelezionato": 1,
      "subArt1ArticoloSelezionato": 0,
      "hlTitoli": null,
      "hlArticoli": null,
      "annoDataGU": "2023",
      "dataGUStr": "31-10-2023",
      "tipoSupplementoIt": "",
      "tipoSupplementoEn": "",
      "dataEmanazione": "2023-10-24T00:00:00Z",
      "descrizioneAtto": "DECRETO 24 ottobre 2023, n. 150"
    }
  ],
  "facetMap": {
    "anno_provvedimento": [
      { "codice": "2023", "valore": 2, "descrizione": "2023" }
    ],
    "codice_tipo_provvedimento": [
      { "codice": "DCT", "valore": 2, "descrizione": "DECRETO" }
    ],
    "descrizione_emettitore": [
      { "codice": "MINISTERO DELLA GIUSTIZIA", "valore": 2, "descrizione": "MINISTERO DELLA GIUSTIZIA" }
    ]
  },
  "numeroPagine": 1,
  "numeroAttiTrovati": 2,
  "paginaCorrente": 1,
  "numeroElementiPerPagina": 0
}
```

**Codici di risposta:**

| Codice (HTTP) | Descrizione | Formato | Esempio Response Body |
|---|---|---|---|
| 200 | Richiesta elaborata e risultati estratti con successo | JSON | Vedere contenuto response riportato sopra |
| 400 | Richiesta mal formata / Input non valido | JSON | `{ "timestamp": "2025-05-08T09:30:38.798+00:00", "status": 400, "error": "Bad Request", "path": "/bff-opendata/api/v1/ricerca/avanzata" }` |
| 404 | Risorsa non trovata o non correttamente specificata | JSON | `{ "code": "404", "type": "Status report", "message": "Runtime Error", "description": "No matching resource found for given API Request" }` |
| 500 | Errore interno del server | JSON | `{ "message": "Errore generico della chiamata, riprovare più tardi", "code": "500" }` |

---

### 1.3.3 Ricerca Semplice o avanzata con FacetMap

**Suffisso URL:**
- `/bff-opendata/v1/api/v1/ricerca/semplice`
- oppure `/bff-opendata/v1/api/v1/ricerca/avanzata`

**Descrizione:** ricerca semplice o avanzata (secondo quanto riportato nei paragrafi precedenti, con aggiunta dei filtri di ricerca `filtriMap`).

**Input previsti:**

- Inserire gli stessi input già previsti per ricerca semplice (rif. 1.3.1) e avanzata (rif. 1.3.2)
- `filtriMap`: filtri di ricerca da aggiungere alla ricerca semplice o avanzata, tra i seguenti previsti:
  - `codice_tipo_provvedimento`: identificativo del tipo di provvedimento recuperato con la chiamata all'API di cui al par. 1.2.5
  - `anno_provvedimento`: anno del provvedimento

**Esempio chiamata (ricerca semplice):**

```bash
curl 'https://pre.api.normattiva.it/t/normattiva.api/bff-opendata/v1/api/v1/ricerca/semplice' \
  -H 'Accept: application/json, text/plain, */*' \
  -H 'Accept-Language: it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7' \
  -H 'Connection: keep-alive' \
  -H 'Content-Type: application/json' \
  -H 'Origin: https://pre.dati.normattiva.it' \
  -H 'Sec-Fetch-Dest: empty' \
  -H 'Sec-Fetch-Mode: cors' \
  -H 'Sec-Fetch-Site: same-site' \
  -H 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36' \
  -H 'sec-ch-ua: "Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"' \
  -H 'sec-ch-ua-mobile: ?0' \
  -H 'sec-ch-ua-platform: "Windows"' \
  --data-raw '{"testoRicerca":"legge","orderType":"recente","paginazione":{"paginaCorrente":1,"numeroElementiPerPagina":10},"filtriMap":{"codice_tipo_provvedimento":"DCT", "anno_provvedimento": 2022}}'
```

**Esempio response (struttura sintetica — `listaAtti` contiene N atti coerenti con i filtri; di seguito si riporta un atto rappresentativo e l'aggregato `facetMap` / paginazione):**

```json
{
  "listaAtti": [
    {
      "numeroAtto": "212",
      "numeroAttoAlfanumerico": "212",
      "dataGU": "2023-02-16",
      "numeroGU": "39",
      "codiceRedazionale": "23G00018",
      "titoloAtto": "[Regolamento recante modalita' di svolgimento dei concorsi pubblici per l'accesso ai ruoli della banda musicale del Corpo nazionale dei vigili del fuoco, ai sensi dell'articolo 126 del decreto legislativo 13 ottobre 2005, n. 217. (23G00018) ]",
      "giornoProvvedimento": "29",
      "meseProvvedimento": "12",
      "meseProvvedimentoIta": "dicembre",
      "meseProvvedimentoEng": "December",
      "annoProvvedimento": "2022",
      "numeroProvvedimento": "212",
      "denominazioneAtto": "DECRETO",
      "numeroSupplemento": "0",
      "tipoSupplemento": "NO",
      "suffissoArticoloSelezionato": 1,
      "subArt1ArticoloSelezionato": 0,
      "hlTitoli": null,
      "hlArticoli": null,
      "annoDataGU": "2023",
      "dataGUStr": "16-02-2023",
      "tipoSupplementoIt": "",
      "tipoSupplementoEn": "",
      "dataEmanazione": "2022-12-29T00:00:00Z",
      "descrizioneAtto": "DECRETO 29 dicembre 2022, n. 212"
    }
    // ... ulteriori atti del 2022 con denominazione DECRETO (n. 211, 210, 209, 208, 207, 205, 202, 194, 193, ...)
  ],
  "facetMap": {
    "anno_provvedimento": [
      { "codice": "2022", "valore": 53, "descrizione": "2022" }
    ],
    "codice_tipo_provvedimento": [
      { "codice": "DCT", "valore": 53, "descrizione": "DECRETO" }
    ],
    "descrizione_emettitore": [
      { "codice": "MINISTERO DELL'INTERNO", "valore": 10, "descrizione": "MINISTERO DELL'INTERNO" },
      { "codice": "MINISTERO DELL'ECONOMIA E DELLE FINANZE", "valore": 9, "descrizione": "MINISTERO DELL'ECONOMIA E DELLE FINANZE" },
      { "codice": "MINISTERO DELLO SVILUPPO ECONOMICO", "valore": 6, "descrizione": "MINISTERO DELLO SVILUPPO ECONOMICO" },
      { "codice": "MINISTERO DELLA SALUTE", "valore": 5, "descrizione": "MINISTERO DELLA SALUTE" },
      { "codice": "MINISTERO DELLE INFRASTRUTTURE E DELLA MOBILITA' SOSTENIBILI", "valore": 5, "descrizione": "MINISTERO DELLE INFRASTRUTTURE E DELLA MOBILITA' SOSTENIBILI" },
      { "codice": "MINISTERO DELLA GIUSTIZIA", "valore": 4, "descrizione": "MINISTERO DELLA GIUSTIZIA" },
      { "codice": "MINISTERO DELL'ISTRUZIONE", "valore": 3, "descrizione": "MINISTERO DELL'ISTRUZIONE" },
      { "codice": "MINISTERO DEL LAVORO E DELLE POLITICHE SOCIALI", "valore": 2, "descrizione": "MINISTERO DEL LAVORO E DELLE POLITICHE SOCIALI" },
      { "codice": "MINISTERO DELLA TRANSIZIONE ECOLOGICA", "valore": 2, "descrizione": "MINISTERO DELLA TRANSIZIONE ECOLOGICA" },
      { "codice": "MINISTERO DEGLI AFFARI ESTERI E DELLA COOPERAZIONE INTERNAZIONALE", "valore": 1, "descrizione": "MINISTERO DEGLI AFFARI ESTERI E DELLA COOPERAZIONE INTERNAZIONALE" },
      { "codice": "MINISTERO DELL'UNIVERSITA' E DELLA RICERCA", "valore": 1, "descrizione": "MINISTERO DELL'UNIVERSITA' E DELLA RICERCA" },
      { "codice": "MINISTERO DELLA CULTURA", "valore": 1, "descrizione": "MINISTERO DELLA CULTURA" },
      { "codice": "MINISTERO DELLA DIFESA", "valore": 1, "descrizione": "MINISTERO DELLA DIFESA" },
      { "codice": "MINISTERO DELLE INFRASTRUTTURE E DEI TRASPORTI", "valore": 1, "descrizione": "MINISTERO DELLE INFRASTRUTTURE E DEI TRASPORTI" },
      { "codice": "PRESIDENZA DEL CONSIGLIO DEI MINISTRI - DIPARTIMENTO PER LA TRASFORMAZIONE DIGITALE", "valore": 1, "descrizione": "PRESIDENZA DEL CONSIGLIO DEI MINISTRI - DIPARTIMENTO PER LA TRASFORMAZIONE DIGITALE" },
      { "codice": "PRESIDENZA DEL CONSIGLIO DEI MINISTRI DIPARTIMENTO DELLA FUNZIONE PUBBLICA", "valore": 1, "descrizione": "PRESIDENZA DEL CONSIGLIO DEI MINISTRI DIPARTIMENTO DELLA FUNZIONE PUBBLICA" }
    ]
  },
  "numeroPagine": 6,
  "numeroAttiTrovati": 53,
  "paginaCorrente": 1,
  "numeroElementiPerPagina": 0
}
```

**Codici di risposta:**

| Codice (HTTP) | Descrizione | Formato | Esempio Response Body |
|---|---|---|---|
| 200 | Richiesta elaborata e risultati estratti con successo | JSON | Vedere contenuto response riportato sopra |
| 400 | Richiesta mal formata / Input non valido | JSON | `{ "timestamp": "2025-05-08T10:12:58.076+00:00", "status": 400, "error": "Bad Request", "path": "/bff-opendata/api/v1/ricerca/semplice" }` |
| 404 | Risorsa non trovata o non correttamente specificata | JSON | `{ "code": "404", "type": "Status report", "message": "Runtime Error", "description": "No matching resource found for given API Request" }` |
| 500 | Errore interno del server | JSON | `{ "message": "Errore generico della chiamata, riprovare più tardi", "code": "500" }` |

**Esempio chiamata (ricerca avanzata):**

```bash
curl --location 'https://pre.api.normattiva.it/t/normattiva.api/bff-opendata/v1/api/v1/ricerca/avanzata' \
  --header 'Content-Type: application/json' \
  --data-raw '{"denominazioneAtto":"DECRETO","orderType":"recente","titoloRicerca":"legge","testoRicerca":"ministro","dataInizioEmanazione":"2023-01-01","dataFineEmanazione":"2023-12-31","dataInizioPubProvvedimento":"2023-01-01","dataFinePubProvvedimento":"2023-12-31","vigenza":"2025-01-09","classeProvvedimento":"2","paginazione":{"paginaCorrente":1,"numeroElementiPerPagina":10},"filtriMap":{"codice_tipo_provvedimento":"DCT" , "anno_provvedimento":2023}}'
```

**Esempio response:** (struttura analoga a quella del par. 1.3.2, con i filtri `filtriMap` applicati)

```json
{
  "listaAtti": [
    {
      "numeroAtto": "217",
      "numeroAttoAlfanumerico": "217",
      "dataGU": "2023-12-30",
      "numeroGU": "303",
      "codiceRedazionale": "23G00224",
      "titoloAtto": "[Regolamento recante: «Decreto ai sensi dell'articolo 87, commi 1 e 3 del decreto legislativo 10 ottobre 2022, n. 150 ... (23G00224) ]",
      "denominazioneAtto": "DECRETO",
      "annoProvvedimento": "2023",
      "numeroProvvedimento": "217",
      "dataEmanazione": "2023-12-29T00:00:00Z",
      "descrizioneAtto": "DECRETO 29 dicembre 2023, n. 217"
      // ... (ulteriori campi come da modello precedente)
    },
    {
      "numeroAtto": "150",
      "numeroAttoAlfanumerico": "150",
      "dataGU": "2023-10-31",
      "numeroGU": "255",
      "codiceRedazionale": "23G00163",
      "titoloAtto": "[Regolamento recante la determinazione dei criteri e delle modalita' di iscrizione e tenuta del registro degli organismi di mediazione ... (23G00163) ]",
      "denominazioneAtto": "DECRETO",
      "annoProvvedimento": "2023",
      "numeroProvvedimento": "150",
      "dataEmanazione": "2023-10-24T00:00:00Z",
      "descrizioneAtto": "DECRETO 24 ottobre 2023, n. 150"
      // ... (ulteriori campi come da modello precedente)
    }
  ],
  "facetMap": {
    "anno_provvedimento": [
      { "codice": "2023", "valore": 2, "descrizione": "2023" }
    ],
    "codice_tipo_provvedimento": [
      { "codice": "DCT", "valore": 2, "descrizione": "DECRETO" }
    ],
    "descrizione_emettitore": [
      { "codice": "MINISTERO DELLA GIUSTIZIA", "valore": 2, "descrizione": "MINISTERO DELLA GIUSTIZIA" }
    ]
  },
  "numeroPagine": 1,
  "numeroAttiTrovati": 2,
  "paginaCorrente": 1,
  "numeroElementiPerPagina": 0
}
```

**Codici di risposta:**

| Codice (HTTP) | Descrizione | Formato | Esempio Response Body |
|---|---|---|---|
| 200 | Richiesta elaborata e risultati estratti con successo | JSON | Vedere contenuto response riportato sopra |
| 400 | Richiesta mal formata / Input non valido | JSON | `{ "timestamp": "2025-05-08T10:21:14.804+00:00", "status": 400, "error": "Bad Request", "path": "/bff-opendata/api/v1/ricerca/avanzata" }` |
| 404 | Risorsa non trovata o non correttamente specificata | JSON | `{ "code": "404", "type": "Status report", "message": "Runtime Error", "description": "No matching resource found for given API Request" }` |
| 500 | Errore interno del server | JSON | `{ "message": "Errore generico della chiamata, riprovare più tardi", "code": "500" }` |

> Relativamente alla ricerca in modalità asincrona (sia essa semplice o avanzata), si riporta un sequence diagram delle chiamate da eseguire le cui API sono descritte nei par. 1.3.4, 1.3.5, 1.3.6.

**Sequence diagram (descrizione testuale del flusso asincrono):**

1. L'utente invoca **NuovaRicerca** (`/nuova-ricerca`) → la response `200/202` ha nel body il **token** della richiesta.
2. L'utente invoca **ConfermaRicerca** (`/conferma-ricerca/<token>`) → questo crea il **Job** asincrono di ricerca (`RicercaAsincrona`).
3. L'utente esegue **polling** invocando **CheckStatus** (`/check-status/<token>`):
   - Se `status_code = 200` → continuare il polling.
   - Se `status_code = 303` → recuperare dal header `x-ipzs-location` la URL di download.
4. L'utente invoca infine **DownloadCollectionAsincrona** (`/collections/download/collection-asincrona/<token>`) per scaricare lo zip.

---

### 1.3.4 Inserimento richiesta export

**Suffisso URL:** `/bff-opendata/v1/api/v1/ricerca-asincrona/nuova-ricerca`

**Descrizione:** avvio della ricerca semplice o avanzata, in modalità asincrona, che permette di esportare e ricevere collezioni di atti organizzati in un archivio `.ZIP` secondo un determinato formato di esportazione (AKN, HTML, JSON, URI, XML).

> **Nota.** Occorre confermare ciascuna richiesta di esportazione inviata, utilizzando il token che costituisce il valore dell'`ID_COLLEZIONE`. Tale token è presente sia nella mail che viene inviata all'utente per confermare la richiesta che nel body della risposta al presente servizio (token di tipo string alfanumerico). L'`ID_COLLEZIONE` va utilizzato anche per l'invocazione dello stato della richiesta ("check status"), da passare in input all'API di cui al par. 1.3.6.

**Input previsti:**

- Inserire gli stessi input già previsti per ricerca semplice (rif. 1.3.1) e avanzata (rif. 1.3.2)
- `formato`: formato di esportazione richiesto, recuperato dalla chiamata all'API di cui al par. 1.2.1
- `tipoRicerca`: `"S"` (Ricerca Semplice), `"A"` (Ricerca Avanzata)
- `modalita` *(opzionale)*: `"C"` (Classica), `"R"` (Responsive)
- `email` *(opzionale)*: indirizzo e-mail del destinatario del risultato di ricerca
- `filtriMap`: filtri di ricerca da aggiungere alla ricerca semplice o avanzata, tra i seguenti previsti:
  - `codice_tipo_provvedimento`: identificativo del tipo di provvedimento recuperato con la chiamata all'API di cui al par. 1.2.5
  - `anno_provvedimento`: anno del provvedimento

**Esempio di chiamata (richiesta di export atti con ricerca semplice):**

```bash
curl 'https://pre.api.normattiva.it/t/normattiva.api/bff-opendata/v1/api/v1/ricerca-asincrona/nuova-ricerca' \
  -H 'Accept: application/json, text/plain, */*' \
  -H 'Accept-Language: it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7' \
  -H 'Connection: keep-alive' \
  -H 'Content-Type: application/json' \
  -H 'Origin: https://pre.dati.normattiva.it' \
  -H 'Sec-Fetch-Dest: empty' \
  -H 'Sec-Fetch-Mode: cors' \
  -H 'Sec-Fetch-Site: same-site' \
  -H 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36' \
  -H 'sec-ch-ua: "Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"' \
  -H 'sec-ch-ua-mobile: ?0' \
  -H 'sec-ch-ua-platform: "Windows"' \
  --data-raw '{"formato":"PDF","tipoRicerca":"S","modalita":"C","email":"m.lucchese@ipzs.it","parametriRicerca":{"filtriMap":{"codice_tipo_provvedimento":"DCS"},"testoRicerca":"104","vigenza":"2025-01-07"}}'
```

**Esempio response:**

- **BODY** (con token della richiesta): `bbe2c735-de04-4f52-af69-a8c1dec46636`
- **http response status code:** `202 Accepted`

**Codici di risposta:**

| Codice (HTTP) | Descrizione | Formato | Esempio Response Body |
|---|---|---|---|
| 200 | Nuova ricerca asincrona accettata con successo | JSON | — |
| 202 | Nuova ricerca asincrona accettata con successo e restituito in risposta il token per controllare stato della ricerca | Text | `8485c51c-0911-4901-83d4-9f90a127cbd2` |
| 400 | Richiesta mal formata / Input non valido | JSON | `{ "timestamp": "2025-05-09T08:21:51.366+00:00", "status": 400, "error": "Bad Request", "path": "/bff-opendata/api/v1/ricerca-asincrona/nuova-ricerca" }` |
| 400 | Formato di esportazione non consentito | JSON | `{ "message": " Sono stati rilevati i seguenti errori: formato di esportazione non consentito; ", "code": "1003" }` |
| 404 | Risorsa non trovata o non correttamente specificata | JSON | `{ "code": "404", "type": "Status report", "message": "Runtime Error", "description": "No matching resource found for given API Request" }` |
| 500 | Errore interno del server | JSON | `{ "message": "Errore generico della chiamata, riprovare più tardi", "code": "500" }` |

**Esempio di chiamata (richiesta di export atti con ricerca avanzata):**

```bash
curl --location 'https://pre.api.normattiva.it/t/normattiva.api/bff-opendata/v1/api/v1/ricerca-asincrona/nuova-ricerca' \
  --header 'Content-Type: application/json' \
  --data-raw '{"formato":"PDF","tipoRicerca":"A","modalita":"C","email":"m.lucchese@ipzs.it","parametriRicerca":{"filtriMap":{"codice_tipo_provvedimento":"DCS"}}, "denominazioneAtto":"DECRETO","orderType":"recente","titoloRicerca":"legge","testoRicerca":"ministro","dataInizioEmanazione":"2023-01-01","dataFineEmanazione":"2023-12-31","dataInizioPubProvvedimento":"2023-01-01","dataFinePubProvvedimento":"2023-12-31","vigenza":"2025-01-09","classeProvvedimento":"2"}'
```

**Esempio response:**

- **BODY:** VUOTO
- **http response status code:** `200 OK`

**Codici di risposta:**

| Codice (HTTP) | Descrizione | Formato | Esempio Response Body |
|---|---|---|---|
| 200 | Richiesta elaborata e risultati estratti con successo | JSON | — |
| 202 | Accettata | Text | `d69c52dd-c9e7-4b94-b7a8-9210f80d25eb` |
| 400 | Richiesta mal formata / Input non valido | JSON | `{ "timestamp": "2025-05-08T10:32:49.080+00:00", "status": 400, "error": "Bad Request", "path": "/bff-opendata/api/v1/ricerca-asincrona/nuova-ricerca" }` |
| 400 | Formato di esportazione non consentito | JSON | `{ "message": " Sono stati rilevati i seguenti errori: formato di esportazione non consentito; ", "code": "1003" }` |
| 404 | Risorsa non trovata o non correttamente specificata | JSON | `{ "code": "404", "type": "Status report", "message": "Runtime Error", "description": "No matching resource found for given API Request" }` |
| 500 | Errore interno del server | JSON | `{ "message": "Errore generico della chiamata, riprovare più tardi", "code": "500" }` |

---

### 1.3.5 Conferma ricerca

**Suffisso URL:** `/bff-opendata/v1/api/v1/ricerca-asincrona/conferma-ricerca`

**Descrizione:** link che permette di confermare la richiesta di esportazione avviata con l'API di cui al par. 1.3.4. Nel body occorre passare il valore dell'`ID_COLLEZIONE` che coincide con il token ricevuto con l'invocazione dell'API di cui al par. 1.3.4.

**Esempio chiamata:**

```bash
curl 'https://pre.api.normattiva.it/t/normattiva.api/bff-opendata/v1/api/v1/ricerca-asincrona/conferma-ricerca' \
  -X 'PUT' \
  -H 'Accept: application/json, text/plain, */*' \
  -H 'Accept-Language: it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7' \
  -H 'Connection: keep-alive' \
  -H 'Content-Type: application/json' \
  -H 'Origin: https://pre.dati.normattiva.it' \
  -H 'Sec-Fetch-Dest: empty' \
  -H 'Sec-Fetch-Mode: cors' \
  -H 'Sec-Fetch-Site: same-site' \
  -H 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36' \
  -H 'sec-ch-ua: "Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"' \
  -H 'sec-ch-ua-mobile: ?0' \
  -H 'sec-ch-ua-platform: "Windows"' \
  --data-raw '{"token":"f1a2e1f8-95bf-434b-9575-af6bba94212d"}'
```

**Esempio request:**

```json
{ "token": "f1a2e1f8-95bf-434b-9575-af6bba94212d" }
```

**Esempio response (status code 200 OK):**

```json
{
  "stato": 3,
  "descrizioneStato": "Ricerca elaborata con successo",
  "descrizioneErrore": null
}
```

**Codici di risposta:**

| Codice (HTTP) | Descrizione | Formato | Esempio Response Body |
|---|---|---|---|
| 200 | Nuova ricerca asincrona confermata con successo | JSON | `{ "stato": 1, "descrizioneStato": "Ricerca confermata in attesa di elaborazione", "descrizioneErrore": null }` — oppure `{ "stato": 2, "descrizioneStato": "Ricerca confermata e in elaborazione", "descrizioneErrore": null }` — oppure `{ "stato": 3, "descrizioneStato": "Ricerca elaborata con successo", "descrizioneErrore": null }` |
| 202 | Nuova ricerca asincrona confermata con successo. Possibile prolungamento tempi di fornitura URL di download della collezione. | JSON | `{ "stato": 6, "descrizioneStato": "Nuova ricerca asincrona confermata con successo. Possibile prolungamento tempi di fornitura URL di download della collezione.", "descrizioneErrore": null }` |
| 404 | Risorsa non trovata per la ricerca impostata | JSON | URL non corretta: `{ "code": "404", "type": "Status report", "message": "Runtime Error", "description": "No matching resource found for given API Request" }` — URL corretta ma token non trovato: `{ "message": "Nessuna ricerca con token [33502980-d6ff-4349-8484-fdcf7c01b83aZ] trovata", "code": "1204" }` |
| 500 | Errore interno del server | JSON | `{ "message": "Errore generico della chiamata, riprovare più tardi", "code": "500" }` |
| 503 | Carico eccessivo. Impossibile prendere in carico la richiesta. URL di collezione predefinita equivalente fornita in uscita. | JSON | `{ "stato": 5, "descrizioneStato": "Carico eccessivo. Impossibile prendere in carico la richiesta. URL di collezione predefinita equivalente fornita in uscita.", "descrizioneErrore": null }` |

---

### 1.3.6 Download Ricerca

**Suffisso URL:** `/bff-opendata/v1/api/v1/ricerca-asincrona/check-status/<ID_COLLEZIONE>`

**Descrizione:** API per verificare lo stato di elaborazione della richiesta di esportazione atti avviata con invocazione dell'API di cui al par. 1.3.4 (in *query string* occorre passare il valore dell'`ID_COLLEZIONE` che coincide con il token ricevuto da quest'ultima API – ad es. `https://pre.api.normattiva.it/t/normattiva.api/bff-opendata/v1/api/v1/ricerca-asincrona/check-status/f1a2e1f8-95bf-434b-9575-af6bba94212d`).

> **Nota.** Finché il fruitore riceve in risposta uno status code pari a `200`, occorre continuare a controllare in modalità polling lo stato di elaborazione della richiesta richiamando la presente API passando in *query string* il token ricevuto. Nel momento in cui si riceve uno status code `303`, occorre recuperare dalla header `x-ipzs-location` del messaggio di risposta la URI da utilizzare per effettuare il download in GET del file zippato contenente l'export della collezione.

**Esempio di chiamata:**

```bash
curl 'https://pre.api.normattiva.it/t/normattiva.api/bff-opendata/v1/api/v1/ricerca-asincrona/check-status/f1a2e1f8-95bf-434b-9575-af6bba94212d' \
  -H 'Accept: application/json, text/plain, */*' \
  -H 'Accept-Language: it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7' \
  -H 'Connection: keep-alive' \
  -H 'Origin: https://pre.dati.normattiva.it' \
  -H 'Sec-Fetch-Dest: empty' \
  -H 'Sec-Fetch-Mode: cors' \
  -H 'Sec-Fetch-Site: same-site' \
  -H 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36' \
  -H 'sec-ch-ua: "Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"' \
  -H 'sec-ch-ua-mobile: ?0' \
  -H 'sec-ch-ua-platform: "Windows"'
```

**Esempio response:**

```json
{
  "stato": 3,
  "descrizioneStato": "Ricerca elaborata con successo",
  "descrizioneErrore": null
}
```

Nel caso di `status_code = 303`, nel header `x-ipzs-location` si troverà la URL per il download dello zip corrispondente alla richiesta. Ad esempio:

```
x-ipzs-location = https://pre.api.normattiva.it/t/normattiva.api/bff-opendata/v1/api/v1/collections/download/collection-asincrona/f1a2e1f8-95bf-434b-9575-af6bba94212d
```

**Codici di risposta:**

| HTTP Status | Descrizione | Formato | Esempio Response Body |
|---|---|---|---|
| 200 | Interrogazione eseguita con successo | JSON | Vedere contenuto response riportato sopra |
| 303 | Interrogazione eseguita con successo e restituito url per download risultato ricerca | JSON | `{ "stato": 3, "descrizioneStato": "Ricerca elaborata con successo", "descrizioneErrore": null }` |
| 404 | Risorsa non trovata o non correttamente specificata | JSON | `{ "code": "404", "type": "Status report", "message": "Runtime Error", "description": "No matching resource found for given API Request" }` |
| 500 | Errore interno del server | JSON | `{ "message": "Errore generico della chiamata, riprovare più tardi", "code": "500" }` |

---

### 1.3.7 Visualizzazione dettaglio atto

**Suffisso URL:** `/bff-mobile/v1/api/v1/atto/dettaglio-atto`

**Descrizione:** API per visualizzare il dettaglio di un atto, navigando per articolo.

**Input previsti:**

- `dataGU` (obbligatorio): data pubblicazione in GU – nel formato `YYYY-DD-MM`
- `codiceRedazionale` (obbligatorio): codice redazionale
- `idArticolo`: numero articolo nell'atto richiesto
- `sottoArticolo`: sottoarticolo (se presente) nell'atto richiesto
- `dataVigenza`: data di vigenza atto - nel formato `YYYY-DD-MM`
- `idGruppo`: id gruppo degli articoli (se presente) per l'atto richiesto
- `progressivo`: progressivo dell'articolo
- `versione`: versione dell'atto (`0` per l'atto originale)

**Esempio di chiamata:**

```bash
curl --location 'https://pre.api.normattiva.it/t/normattiva.api/bff-opendata/v1/api/v1/atto/dettaglio-atto' \
  -X 'POST' \
  --header 'accept: */*' \
  --header 'Content-Type: application/json' \
  --data '{
    "dataGU": "1988-09-12",
    "codiceRedazionale": "088G0458",
    "idArticolo": 13,
    "sottoArticolo": 2,
    "sottoArticolo1": 0,
    "dataVigenza": "2025-02-27",
    "idGruppo": 6,
    "progressivo": 0,
    "versione": 0
  }'
```

**Esempio response (status code 200):**

```json
{
  "data": {
    "atto": {
      "titolo": "LEGGE 23 agosto 1988, n. 400",
      "sottoTitolo": "Disciplina dell'attivita' di Governo e ordinamento della\r\nPresidenza del Consiglio dei Ministri.\r\n",
      "dataPubblicazioneGazzetta": null,
      "articoloHtml": "<div class=\"bodyTesto\">...(HTML completo dell'articolo, contenente: titolo articolo 'Art. 13-bis', testo introduttivo '(Chiarezza dei testi normativi)' e i commi 1, 2, 3, 4 con i relativi paragrafi e voci puntate a) e b))...</div>",
      "tipoProvvedimentoDescrizione": "LEGGE",
      "tipoProvvedimentoCodice": "PLE",
      "annoProvvedimento": 1988,
      "meseProvvedimento": 8,
      "giornoProvvedimento": 23,
      "numeroProvvedimento": 400,
      "tipoSupplementoCode": "SO",
      "numeroSupplemento": 86,
      "annoGU": 1988,
      "meseGU": 9,
      "giornoGU": 12,
      "numeroGU": 214,
      "dataPubblicazioneInGazzetta": null,
      "articoloDataInizioVigenza": "20090704",
      "articoloDataFineVigenza": "99999999",
      "testoInVigore": null
    },
    "message": null
  },
  "success": true
}
```

> Il campo `articoloHtml` contiene il markup HTML dell'articolo richiesto (Art. 13-bis "Chiarezza dei testi normativi"), strutturato in `<h2>`, `<div class="art-comma-div-akn">`, `<span class="comma-num-akn">`, `<div class="pointedList-*-akn">` e includente i commi 1–4 con le voci puntate.

**Codici di risposta:**

| HTTP Status | Descrizione | Formato | Esempio Response Body |
|---|---|---|---|
| 200 | Interrogazione eseguita con successo | JSON | Vedere contenuto response riportato sopra |
| 400 | Richiesta mal formata / Input non valido | JSON | `{ "timestamp": "2025-05-08T08:48:39.252+00:00", "status": 400, "error": "Bad Request", "path": "/bff-mobile/api/v1/atto/dettaglio-atto" }` |
| 404 | Risorsa non trovata per la ricerca impostata | JSON | URL non corretta: `{ "code": "404", "type": "Status report", "message": "Runtime Error", "description": "No matching resource found for given API Request" }` — URL corretta ma esito vuoto: `{ "message": "Atto non trovato", "code": null }` |
| 500 | Errore interno del server | JSON | `{ "message": "Errore generico della chiamata, riprovare più tardi", "code": "500" }` |

---

### 1.3.8 Download collezione preconfezionata

**Suffisso URL:** `/bff-opendata/v1/api/v1/collections/download/collection-preconfezionata`

**Descrizione:** API per scaricare un file `.zip` contenente gli atti, nel formato scelto tra le possibili opzioni (AKN, EPUB, HTML, JSON, PDF, RTF, XML, URI), relativi alla collection preconfezionata di interesse.

**Input previsti:**

- `nome` (obbligatorio): nome della collection
- `formato` (obbligatorio): formato dei file relativi alla collection che si desidera scaricare
- `formatoRichiesta` (obbligatorio): modalità relativa al tipo di download (`O`: Originario; `V`: Vigente; `M`: Multivigente)

**Esempio di chiamata:**

```bash
curl 'https://pre.api.normattiva.it/t/normattiva.api/bff-opendata/v1/api/v1/collections/download/collection-preconfezionata?nome=Codici&formato=AKN&formatoRichiesta=O' \
  -H 'Accept: application/json, text/plain, */*' \
  -H 'Accept-Encoding: gzip, deflate, br, zstd' \
  -H 'Accept-Language: it,it-IT;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6' \
  -H 'Connection: keep-alive' \
  -H 'Host: pre.api.normattiva.it' \
  -H 'Origin: https://pre.dati.normattiva.it' \
  -H 'Sec-Fetch-Dest: empty' \
  -H 'Sec-Fetch-Mode: cors' \
  -H 'Sec-Fetch-Site: same-site' \
  -H 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36 Edg/133.0.0.0' \
  -H 'sec-ch-ua: "Not(A:Brand";v="99", "Microsoft Edge";v="133", "Chromium";v="133"' \
  -H 'sec-ch-ua-mobile: ?0' \
  -H 'sec-ch-ua-platform: "Windows"'
```

**Esempio response:**

- **BODY:** contenuto binario (file `.zip`)
- **http response status code:** `200 OK`

**Codici di risposta:**

| HTTP Status | Descrizione | Formato | Esempio Response Body |
|---|---|---|---|
| 200 | File scaricato con successo | binario | Vedere contenuto response riportato sopra |
| 400 | Richiesta errata o file non valido | JSON | `{ "message": "Errore nella convalida dei dati di input", "code": "1005" }` |
| 400 | Formato vigenza non consentito | JSON | `{ "message": "Formato vigenza non consentito (valori consentiti O,M,V)", "code": "1006" }` |
| 400 | Formato di esportazione non consentito | JSON | `{ "message": "formato di esportazione non consentito", "code": "1003" }` |
| 404 | Risorsa non trovata per la ricerca impostata | JSON | URL non corretta: `{ "code": "404", "type": "Status report", "message": "Runtime Error", "description": "No matching resource found for given API Request" }` — URL corretta ma collezione preconfezionata non trovata: `{ "message": "Risorsa non presente", "code": "1200" }` |
| 500 | Errore interno del server | JSON | `{ "message": "Errore generico della chiamata, riprovare più tardi", "code": "500" }` |

---

### 1.3.9 Ricerca Atti aggiornati

**Suffisso URL:** `/bff-opendata/v1/api/v1/ricerca/aggiornati`

**Descrizione:** API per ottenere la lista di atti aggiornati in un intervallo compreso tra due date, passate come parametri di input.

**Input previsti:**

- `dataInizioAggiornamento` (obbligatorio): data inizio intervallo temporale
- `dataFineAggiornamento` (obbligatorio): data fine intervallo temporale

**Esempio di chiamata:**

```bash
curl -X 'POST' \
  'https://pre.api.normattiva.it/t/normattiva.api/bff-opendata/v1/api/v1/ricerca/aggiornati' \
  -H 'accept: */*' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer undefined' \
  -d '{
    "dataInizioAggiornamento": "2024-04-27T11:43:51.827Z",
    "dataFineAggiornamento": "2024-04-29T11:43:51.827Z"
  }'
```

**Esempio response (estratto — atti dal 2020 al 2024 aggiornati nell'intervallo richiesto):**

```json
{
  "listaAtti": [
    {
      "numeroAtto": "1",
      "numeroAttoAlfanumerico": "14",
      "dataGU": "2024-02-22",
      "numeroGU": "44",
      "codiceRedazionale": "24G00028",
      "titoloAtto": "Ratifica ed esecuzione del Protocollo tra il Governo della Repubblica italiana e il Consiglio dei ministri della Repubblica di Albania per il rafforzamento della collaborazione in materia migratoria, fatto a Roma il 6 novembre 2023, nonche' norme di coordinamento con l'ordinamento interno. (24G00028) ",
      "giornoProvvedimento": "21",
      "meseProvvedimento": "2",
      "annoProvvedimento": "2024",
      "numeroProvvedimento": "14",
      "denominazioneAtto": "LEGGE",
      "numeroSupplemento": "0",
      "tipoSupplemento": "NO",
      "annoDataGU": "2024",
      "dataGUStr": "22-02-2024",
      "descrizioneAtto": "LEGGE 21 febbraio 2024, n. 14",
      "dataUltimaModifica": "2024-04-29",
      "ultimiAttiModificanti": "24A02110"
    },
    {
      "numeroAtto": "2",
      "numeroAttoAlfanumerico": "78",
      "dataGU": "2023-06-28",
      "numeroGU": "149",
      "codiceRedazionale": "23G00085",
      "titoloAtto": "Ratifica ed esecuzione del Protocollo emendativo dell'Accordo tra il Governo della Repubblica italiana ed il Governo della Repubblica di Armenia sull'autotrasporto internazionale di passeggeri e di merci, firmato il 7 agosto 1999, fatto a Jerevan il 31 luglio 2018. (23G00085) ",
      "giornoProvvedimento": "8",
      "meseProvvedimento": "6",
      "annoProvvedimento": "2023",
      "numeroProvvedimento": "78",
      "denominazioneAtto": "LEGGE",
      "annoDataGU": "2023",
      "dataGUStr": "28-06-2023",
      "descrizioneAtto": "LEGGE 8 giugno 2023, n. 78",
      "dataUltimaModifica": "2024-04-29",
      "ultimiAttiModificanti": "24A02109"
    },
    {
      "numeroAtto": "3",
      "numeroAttoAlfanumerico": "39",
      "dataGU": "2022-05-03",
      "numeroGU": "102",
      "codiceRedazionale": "22G00045",
      "titoloAtto": "Ratifica ed esecuzione dell'Accordo tra il Governo della Repubblica italiana e il Governo della Repubblica di Gibuti sulla cooperazione nel settore della difesa, fatto a Roma il 29 gennaio 2020. (22G00045) ",
      "giornoProvvedimento": "14",
      "meseProvvedimento": "4",
      "annoProvvedimento": "2022",
      "numeroProvvedimento": "39",
      "denominazioneAtto": "LEGGE",
      "annoDataGU": "2022",
      "dataGUStr": "03-05-2022",
      "descrizioneAtto": "LEGGE 14 aprile 2022, n. 39",
      "dataUltimaModifica": "2024-04-29",
      "ultimiAttiModificanti": "24A02108"
    },
    {
      "numeroAtto": "4",
      "numeroAttoAlfanumerico": "82",
      "dataGU": "2020-07-28",
      "numeroGU": "188",
      "codiceRedazionale": "20G00101",
      "titoloAtto": "Ratifica ed esecuzione dei seguenti trattati: a) Trattato di estradizione tra la Repubblica italiana e la Repubblica di Colombia, fatto a Roma il 16 dicembre 2016; b) Trattato tra la Repubblica italiana e la Repubblica di Colombia di assistenza giudiziaria in materia penale, fatto a Roma il 16 dicembre 2016; c) Trattato tra la Repubblica italiana e la Repubblica di Colombia sul trasferimento delle persone condannate, fatto a Roma il 16 dicembre 2016. (20G00101) ",
      "giornoProvvedimento": "17",
      "meseProvvedimento": "7",
      "annoProvvedimento": "2020",
      "numeroProvvedimento": "82",
      "denominazioneAtto": "LEGGE",
      "annoDataGU": "2020",
      "dataGUStr": "28-07-2020",
      "descrizioneAtto": "LEGGE 17 luglio 2020, n. 82",
      "dataUltimaModifica": "2024-04-29",
      "ultimiAttiModificanti": "24A02106 24A02107"
    }
  ],
  "facetMap": {},
  "numeroPagine": 1,
  "numeroAttiTrovati": 4,
  "paginaCorrente": 1,
  "numeroElementiPerPagina": 0,
  "message": null
}
```

> Nota: gli oggetti atto contengono inoltre i campi `meseProvvedimentoIta`, `meseProvvedimentoEng`, `suffissoArticoloSelezionato`, `subArt1ArticoloSelezionato`, `hlTitoli`, `hlArticoli`, `tipoSupplementoIt`, `tipoSupplementoEn`, `dataEmanazione` (analogamente alle altre API), come da specifica completa.

**Codici di risposta:**

| HTTP Status | Descrizione | Formato | Esempio Response Body |
|---|---|---|---|
| 200 | File scaricato con successo | JSON | Vedere contenuto response riportato sopra |
| 400 | Richiesta errata o file non valido | JSON | `{ "timestamp": "2025-05-08T12:01:14.236+00:00", "status": 400, "error": "Bad Request", "path": "/bff-opendata/api/v1/ricerca/aggiornati" }` |
| 400 | Superato massimo intervallo temporale consentito (12 mesi) | JSON | `{ "message": "periodo di esportazione superiore a 12 mesi", "code": "1501" }` |
| 400 | Superato la dimensione massima dei risultati di ricerca (7000 atti) | JSON | `{ "message": " Numero di atti superiore al limite consentito di 7000, raffinare la ricerca ", "code": "1502" }` |
| 400 | Intervallo temporale incoerente: la data finale precede quella iniziale | JSON | `{ "message": "La data finale è precedente alla data iniziale, correggere i parametri", "code": "1503" }` |
| 404 | Risorsa non trovata per la ricerca impostata | JSON | `{ "code": "404", "type": "Status report", "message": "Runtime Error", "description": "No matching resource found for given API Request" }` |
| 500 | Errore interno del server | JSON | `{ "message": "Errore generico della chiamata, riprovare più tardi", "code": "500" }` |

---

### 1.3.10 Risposta in caso di errore

Nel presente paragrafo si riporta la struttura della risposta in caso di errori lato client (4xx) e server (5xx) delle API riportate nel presente documento.

La struttura della risposta è in formato JSON e riporta i seguenti campi:

- `timestamp`: data e l'ora della risposta
- `status`: codice di errore (di tipo 4xx o 5xx)
- `error`: descrizione dell'errore riscontrato
- `path`: API richiamata

**Esempi per altri casi di risposta con errore:**

**Risposta con status code 404:**

```json
{
  "timestamp": "2025-02-27T10:22:15.379+00:00",
  "status": 404,
  "error": "Not Found",
  "path": "/bff-mobile/api/v1/atto/dettaglio-atto/"
}
```

**Risposta con status code 500:**

```json
{
  "timestamp": "2025-02-27T10:22:15.379+00:00",
  "status": 500,
  "error": "Errore interno del server",
  "path": "/bff-mobile/api/v1/atto/dettaglio-atto/"
}
```

**Risposta con status code 400:**

```json
{
  "timestamp": "2025-02-27T10:22:15.379+00:00",
  "status": 400,
  "error": " Richiesta mal formata",
  "path": "/bff-mobile/api/v1/atto/dettaglio-atto/"
}
```

**Risposta con status code 422:**

```json
{
  "timestamp": "2025-02-27T10:22:15.379+00:00",
  "status": 422,
  "error": " Richiesta non processabile",
  "path": "/bff-mobile/api/v1/atto/dettaglio-atto/"
}
```

> **N.B.:** per la specifica completa delle interfacce si faccia riferimento al file descrittore del servizio: `openapi-bff-opendata-<VERSION>.json`.

---

# 2. Appendice

## 2.1.1 Configurazione tool "Postman" con esempi chiamate

Si riportano nel presente paragrafo le istruzioni per l'importazione nel tool Postman del file contenente la collection delle chiamate di esempio alle API riportate nel presente documento.

Il tool Postman è scaricabile da qui: <https://www.postman.com/downloads/>

### Importazione della collection delle chiamate di esempio in Postman

1. Selezionare dal menu in alto a sinistra di Postman l'opzione **Import** (`File` → `Import...`, scorciatoia `Ctrl + O`).
2. Selezionare il file `NORMATTIVA OPENDATA.postman_collection.json` contenente la collection da importare dalla directory del proprio pc, oppure trascinarlo nell'area "Drop anywhere to import".
3. La collection con le API di esempio sarà visibile nel menu *MyWorkspace > Collections*, sotto il nome **NORMATTIVA OPENDATA**, e include le voci:
   - `GET ESTENSIONI`
   - `GET COLLECTION PREDEFINITE`
   - `GET RICERCHE PREDEFINITE`
   - `GET CLASSE PROVVEDIMENTO`
   - `GET DENOMINAZIONE ATTO`
   - `POST RICERCA SEMPLICE`
   - `POST RICERCA AVANZATA`
   - `POST RICERCA SEMPLICE CON FACETMAP`
   - `POST RICERCA AVANZATA CON FACETMAP`
   - `POST INSERIMENTO RICHIESTA EXPORT (RICERCA SEMPLICE)`
   - `POST INSERIMENTO RICHIESTA EXPORT (RICERCA AVANZATA)`
   - `PUT CONFERMA RICHIESTA`
   - `GET DOWNLOAD RICERCA (CHECK STATUS)`
   - `GET DOWNLOAD COLLEZIONE PREDEFINITA`

### Configurazione per chiamate alle API in mutua autenticazione (valido solo per ambiente di collaudo)

Nel caso in cui le API siano protette da mutua autenticazione tramite certificato client, occorre configurare Postman nel seguente modo:

1. Accedere al pannello delle impostazioni (**Settings**) in alto a destra.
2. Nella scheda **General**, disabilitare la verifica SSL del certificato (**SSL certificate verification**).
3. Nella scheda **Certificates** inserire il file `.pfx` contenente chiavi/certificato client tramite **Add Certificate...**, specificando:
   - **HOST:** l'endpoint del server delle API (es. `pre.api.normattiva.it`)
   - **PFX file:** percorso al file `.pfx` (es. `C:/Users/.../Downloads/normattivaApp.pfx`)
   - **Passphrase:** la passphrase del certificato

---

*Fine documento — pag. 73 di 73.*
