// Synthetic official-boundary controls. Not live legislation or a signing key for production.
export const publication = { data_gu:'2000-09-28',codice_redazionale:'000G0304' };
export const signingKey = Buffer.alloc(32,7);
const date='2026-10-02';
const nav = (id) => `<a class="numero_articolo" onclick="showArticle('/atto/caricaArticolo?art.idArticolo=${id}&amp;art.idSottoArticolo=1&amp;art.idSottoArticolo1=0&amp;art.flagTipoArticolo=0&amp;art.idGruppo=0&amp;art.progressivo=0&amp;art.versione=1&amp;art.codiceRedazionale=000G0304&amp;art.dataPubblicazioneGazzetta=2000-09-28')">Art. ${id}</a>`;
const article = id => `<article><num>Art. ${id}.</num><content><p>Fixture text ${id}.</p></content></article>`;
const page=`<meta property="eli:id_local" content="000G0304"><input name="dataVigenza" value="02/10/2026"><a href="/do/atto/caricaAKN?dataGU=20000928&amp;codiceRedaz=000G0304&amp;dataVigenza=20261002">AKN</a>${nav(13)}${nav(20)}`;
const xml=`<akomaNtoso xmlns="http://docs.oasis-open.org/legaldocml/ns/akn/3.0"><act name="monovigente"><meta><identification><FRBRWork><FRBRalias name="eli" value="eli/id/2000/09/28/000G0304/CONSOLIDATED/20200101"/></FRBRWork><FRBRExpression><FRBRdate date="2020-01-01"/></FRBRExpression></identification><publication date="2000-09-28"/></meta><body>${article(13)}${article(20)}</body></act></akomaNtoso>`;
export function installTraversalBoundary() {
  globalThis.fetch=async(url,init)=>{
    const target=String(url);
    if(target.startsWith('https://www.normattiva.it/'))return new Response(target.includes('caricaAKN')?xml:page);
    if(!target.startsWith('https://api.normattiva.it/t/normattiva.api/'))throw new Error('Unexpected fixture destination');
    const request=JSON.parse(init.body);
    if(request.idArticolo===999)return new Response('ambiguous coordinates',{status:404});
    return Response.json({success:true,data:{atto:{sottoTitolo:'(000G0304)',annoGU:2000,meseGU:9,giornoGU:28,
      articoloHtml:`<h2>Art. ${request.idArticolo}.</h2><p>Fixture text ${request.idArticolo}.</p>`,
      articoloDataInizioVigenza:'20200101',articoloDataFineVigenza:'99999999'}}});
  };
}
