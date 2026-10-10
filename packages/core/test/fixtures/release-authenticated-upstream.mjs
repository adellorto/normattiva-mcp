// Same exact publication/content for truthful legacy and authenticated reads.
import { publication } from './traversal-upstream.mjs';
export function installAuthenticatedReadingBoundary() {
  const boundary = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (String(url).endsWith('/ricerca/avanzata')) return Response.json({ numeroAttiTrovati: 1, numeroPagine: 1, paginaCorrente: 1,
      listaAtti: [{ dataGU: publication.data_gu, codiceRedazionale: publication.codice_redazionale,
        denominazioneAtto: 'DECRETO LEGISLATIVO', annoProvvedimento: '2000', numeroProvvedimento: '267',
        titoloAtto: 'Independent fixture identity', dataEmanazione: '2000-08-18', numeroGU: '227' }] });
    const response = await boundary(url, init), value = await response.json();
    return Response.json({ ...value, data: { atto: { ...value.data.atto,
      tipoProvvedimentoDescrizione: 'DECRETO LEGISLATIVO', annoProvvedimento: 2000, meseProvvedimento: 8,
      giornoProvvedimento: 18, numeroProvvedimento: 267, numeroGU: 227,
    } } });
  };
}
