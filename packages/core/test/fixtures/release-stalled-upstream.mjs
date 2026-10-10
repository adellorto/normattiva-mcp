// External upstream control for default-transport cancellation/timeout probes.
// Never loaded by production. Real production budgets remain unchanged.
import { appendFileSync } from 'node:fs';
import './public-upstream.mjs';
const boundary = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  if (!String(url).includes('dettaglio-atto') || JSON.parse(init.body).idArticolo !== 997) return boundary(url, init);
  const record = event => appendFileSync(process.env.RELEASE_STALL_EVENTS, JSON.stringify({ event, at: Date.now() }) + '\n');
  record('started');
  return new Promise((resolve, reject) => {
    const abort = () => { record('aborted'); reject(init.signal.reason); };
    if (init.signal.aborted) abort();
    else init.signal.addEventListener('abort', abort, { once: true });
  });
};
