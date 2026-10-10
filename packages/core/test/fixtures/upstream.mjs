// Synthetic boundary fixture, not a captured legal document or live canary.
globalThis.fetch = async (url, init) => {
  if (!String(url).startsWith('https://api.normattiva.it/t/normattiva.api/')) throw new Error('Unexpected fixture destination');
  const request = JSON.parse(init.body ?? '{}');
  if (request.idArticolo === 999) return Response.json({ message: 'coordinate dump' }, { status: 404 });
  if (request.idArticolo === 998) return Response.json({ code: '1000', message: 'private dump' }, { status: 429 });
  return Response.json({ success: true, data: { atto: {
    titolo: 'Synthetic fixture', articoloHtml: '<p>Fixture legal text.</p>',
  } } });
};
