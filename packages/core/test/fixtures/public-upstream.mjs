// Synthetic integration controls, not official-source captures or live legislation.
import { installTraversalBoundary, publication } from './traversal-upstream.mjs';
installTraversalBoundary();
const traversalFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  const target = String(url);
  if (target.endsWith('/ricerca/avanzata')) return Response.json({
    numeroAttiTrovati: 1, numeroPagine: 1, paginaCorrente: 1,
    listaAtti: [{ dataGU: publication.data_gu, codiceRedazionale: publication.codice_redazionale,
      denominazioneAtto: 'DECRETO LEGISLATIVO', annoProvvedimento: '2000', numeroProvvedimento: '267',
      titoloAtto: 'Synthetic TUEL control', dataEmanazione: '2000-08-18' }],
  });
  if (target.endsWith('/ricerca/aggiornati')) return Response.json({ numeroAttiTrovati: 1,
    listaAtti: [{ dataGU: publication.data_gu, codiceRedazionale: publication.codice_redazionale,
      titoloAtto: 'Synthetic amended act', dataUltimaModifica: '2026-10-02' }],
  });
  if (target.endsWith('/tipologiche/denominazione-atto')) return Response.json([{ label: 'PDL', value: 'DECRETO LEGISLATIVO' }]);
  if (target.endsWith('/atto/dettaglio-atto') && JSON.parse(init.body).idArticolo === 998) {
    return Response.json({ code: '1000', message: 'private dump' }, { status: 429 });
  }
  return traversalFetch(url, init);
};
