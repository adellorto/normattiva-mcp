// Synthetic package/HTTP controls. Never loaded in production or live canaries.
import './public-upstream.mjs';
const fetchPublic = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  if (String(url).endsWith('/ricerca/semplice')) {
    const page = JSON.parse(init.body).paginazione.paginaCorrente;
    return Response.json({ listaAtti: Array.from({ length: page === 1 ? 5 : 1 }, (_, i) => ({
      dataGU: '2023-03-31', codiceRedazionale: `SYN${page}${i}`, titoloAtto: `Synthetic act ${page}:${i}`,
    })), numeroAttiTrovati: 6, numeroPagine: 2, paginaCorrente: page });
  }
  return fetchPublic(url, init);
};
