// Synthetic upstream transport fixture; not a live legal/currentness assertion.
export const signingKey = Buffer.alloc(32,19);
export function installDiscoveryBoundary() {
  globalThis.fetch = async (url, init) => {
    if (!String(url).endsWith('/ricerca/semplice')) throw new Error('Unexpected discovery fixture destination');
    const page = JSON.parse(init.body).paginazione.paginaCorrente;
    return Response.json({ listaAtti:Array.from({length:page===1?5:1},(_,i)=>({
      dataGU:'2023-03-31',codiceRedazionale:`SYN${page}${i}`,titoloAtto:`Synthetic act ${page}:${i}`,
    })), numeroAttiTrovati:6,numeroPagine:2,paginaCorrente:page });
  };
}
