export interface AttoListItem {
  annoProvvedimento?: number;
  numeroProvvedimento?: string;
  denominazioneAtto?: string;
  descrizioneAtto?: string;
  titoloAtto?: string;
  codiceRedazionale?: string;
  dataGU?: string;
  dataEmanazione?: string;
  dataPubblicazione?: string;
  classeProvvedimento?: string;
  dataUltimaModifica?: string;
  ultimiAttiModificanti?: string;
}

export interface RicercaResponse {
  numeroAttiTrovati?: number;
  numeroPagine?: number;
  paginaCorrente?: number;
  listaAtti?: AttoListItem[];
  facetMap?: Record<string, Array<{ descrizione: string; valore: number }>>;
}

export interface DettaglioAttoBody {
  dataGU: string;
  codiceRedazionale: string;
  idArticolo: number;
  sottoArticolo: number;
  sottoArticolo1: number;
  dataVigenza: string;
  idGruppo: number;
  progressivo: number;
  versione: number;
}

export interface DettaglioAttoResponse {
  success?: boolean;
  data?: {
    atto?: {
      titolo?: string;
      tipoProvvedimentoDescrizione?: string;
      tipoProvvedimentoCodice?: string;
      articoloHtml?: string;
      articoloDataInizioVigenza?: string;
      articoloDataFineVigenza?: string;
    };
  };
  message?: string;
  code?: string | null;
}

export interface RicercaAvanzataBody {
  testoRicerca?: string;
  titoloRicerca?: string;
  denominazioneAtto?: string;
  annoProvvedimento?: string;
  numeroProvvedimento?: string;
  meseProvvedimento?: string;
  giornoProvvedimento?: string;
  dataInizioEmanazione?: string;
  dataFineEmanazione?: string;
  dataInizioPubProvvedimento?: string;
  dataFinePubProvvedimento?: string;
  vigenza?: string;
  classeProvvedimento?: string;
  orderType: "recente" | "vecchio";
  paginazione: {
    paginaCorrente: number;
    numeroElementiPerPagina: number;
  };
  filtriMap?: Record<string, string | number>;
}

export interface AggiornatiBody {
  dataInizioAggiornamento: string;
  dataFineAggiornamento: string;
}

export interface DenominazioneItem {
  label: string;
  value: string;
}

export interface ClasseItem {
  label: string;
  value: string;
}

export interface CollezioneItem {
  nomeCollezione: string;
  numeroAtti: number;
}

export interface RicercaPredefinita {
  nome: string;
  dettagli: Array<{ nomeCampo: string; valoreCampo: string }>;
  dataCreazione: string;
}

export interface RicerchePredefiniteResponse {
  ricerchePredefinite: RicercaPredefinita[];
}
