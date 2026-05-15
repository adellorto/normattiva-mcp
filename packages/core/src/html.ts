const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  laquo: "«",
  raquo: "»",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  hellip: "…",
  ndash: "–",
  mdash: "—",
  bull: "•",
  middot: "·",
  euro: "€",
  copy: "©",
  reg: "®",
  trade: "™",
  agrave: "à",
  egrave: "è",
  eacute: "é",
  igrave: "ì",
  ograve: "ò",
  ugrave: "ù",
  Agrave: "À",
  Egrave: "È",
  Eacute: "É",
  Igrave: "Ì",
  Ograve: "Ò",
  Ugrave: "Ù",
  sect: "§",
  para: "¶",
  deg: "°",
};

function decodeEntity(entity: string): string {
  // Numeric: &#1234; or &#xAB;
  const numeric = /^&#(x?)([0-9a-f]+);$/i.exec(entity);
  if (numeric && numeric[2]) {
    const code = parseInt(numeric[2], numeric[1] ? 16 : 10);
    if (Number.isFinite(code) && code > 0 && code <= 0x10ffff) {
      try {
        return String.fromCodePoint(code);
      } catch {
        return entity;
      }
    }
    return entity;
  }
  // Named: &name;
  const named = /^&([a-z]+);$/i.exec(entity);
  if (named && named[1]) {
    return NAMED_ENTITIES[named[1]] ?? entity;
  }
  return entity;
}

export function htmlToText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(
      /<a\b[^>]*?\bhref=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
      (_, href: string, inner: string) => {
        // Normattiva citations carry an Akoma-Ntoso URN (urn:nir:...) inside the
        // href. Preserve it as an inline annotation so plain-text consumers can
        // still resolve cross-references; for non-URN links keep just the text.
        const urn = /urn:[a-z]+(?::[^\s"'&<>]+)+/i.exec(href);
        return urn ? `${inner} [${urn[0]}]` : inner;
      },
    )
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr|article|section)>/gi, "\n")
    .replace(/<div\b/gi, "\n<div")
    .replace(/<[^>]+>/g, "")
    .replace(/&(?:#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, decodeEntity)
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
