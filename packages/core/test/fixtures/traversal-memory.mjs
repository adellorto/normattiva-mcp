// Streams saved bytes like fetch: avoids retaining a second uncompressed input
// or constructing an additional full Response buffer in the fixture itself.
import { createReadStream,readFileSync } from 'node:fs';
import { createGunzip } from 'node:zlib';
import { Readable } from 'node:stream';
import { ActTraversal } from '../../dist/traversal.js';
import { UpstreamRuntime } from '../../dist/upstream.js';
const runtime=new UpstreamRuntime({composedAttempts:2});
const pub={data_gu:'1942-04-04',codice_redazionale:'042U0262'};
const direct=JSON.parse(readFileSync(new URL('./acts/civil-direct-coordinate.json',import.meta.url)));
const main=JSON.parse(readFileSync(new URL('./acts/civil-main-control.json',import.meta.url)));
let attempts=0;
globalThis.fetch=async(url,init)=>{
  attempts++;
  if(init?.body)return Response.json(JSON.parse(init.body).idArticolo===1?main:direct);
  const file=String(url).includes('caricaAKN')?'civil-current.xml.gz':'civil-2026-10-02-AKN-V-portal.html.gz';
  return new Response(Readable.toWeb(createReadStream(new URL('./acts/'+file,import.meta.url)).pipe(createGunzip())));
};
const reader=new ActTraversal({signingKey:Buffer.alloc(32,7),upstream:runtime});
const args={act_locator:reader.actLocator(pub),snapshot_date:'2026-10-02',page_size:1};
const started=performance.now();
const results=await Promise.all([reader.listArticles(args),reader.listArticles(args),reader.listArticles(args)]);
if(results.some(r=>!['pending','more'].includes(r.traversal.progress)))throw new Error('Unexpected preparation result');
const preparedMs=performance.now()-started;
const read=await reader.readArticle({act_locator:args.act_locator,snapshot_date:args.snapshot_date,article_reference:'2043'});
if(read.outcome!=='found')throw new Error('Exact captured article was not verified');
reader.evict();
const restarted=new ActTraversal({signingKey:Buffer.alloc(32,7),upstream:runtime,cacheBytes:0});
await restarted.readArticle({article_locator:read.requested.article_locator});
console.log(JSON.stringify({max_rss_kib:process.resourceUsage().maxRSS,attempts,prepared_ms:Math.round(preparedMs),returned_articles:2,
  source_bytes:10613106,concurrent_calls:3,progress:results[0].traversal.progress}));
