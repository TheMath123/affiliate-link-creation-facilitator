import * as cheerio from "cheerio";

type Money = {
  raw?: string;
  value?: number;
  currency?: string;
};

type AliExpressScrape = {
  title: string;
  description?: string;
  images: string[];
  url: string;
  source: "AliExpress";
  price?: Money;
  estimatedTax?: Money;
};

export async function scrapeAliExpress(url: string): Promise<AliExpressScrape> {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
    },
  });

  if (!response.ok) {
    throw new Error("Falha ao acessar a página do AliExpress");
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  // Título
  let title =
    $('h1[data-pl="product-title"]').first().text().trim() ||
    $('h1[data-tticheck="true"]').first().text().trim() ||
    $('meta[property="og:title"]').attr("content")?.trim() ||
    // $('script[type="application/ld+json"]')
    //   .toArray()
    //   .map((s) => safeParseJSON($(s).contents().text()))
    //   .find(
    //     (j: any) =>
    //       j &&
    //       (j["@type"] === "Product" ||
    //         (Array.isArray(j["@type"]) && j["@type"].includes("Product"))),
    //   )?.name ||
    $("title")
      .first()
      .text()
      .trim();

  // Descrição (fallback para meta description)
  let description =
    $(".product-description").first().text().trim() ||
    $(".detail-desc-decorate-richtext").first().text().trim() ||
    $('meta[name="description"]').attr("content")?.trim();

  // Preço
  const price = extractPrice($);
  console.log("price:", price);
  // Imposto estimado
  const estimatedTax = extractEstimatedTax($);
  console.log("estimatedTax:", estimatedTax);

  // Imagens
  const images = extractImages($);

  // Fallbacks do JSON‑LD para preencher lacunas (nome, imagens, preço)
  const ldProducts = $('script[type="application/ld+json"]')
    .toArray()
    .map((s) => safeParseJSON($(s).contents().text()))
    .filter(Boolean) as any[];

  const ldProduct = ldProducts.find((j) => {
    const t = j?.["@type"];
    return t === "Product" || (Array.isArray(t) && t.includes("Product"));
  });

  if (ldProduct) {
    if (!title && ldProduct.name) title = String(ldProduct.name).trim();
    if (images.length === 0 && ldProduct.image) {
      const ldImages: string[] = Array.isArray(ldProduct.image)
        ? ldProduct.image
        : [ldProduct.image];
      for (const img of ldImages) {
        const norm = normalizeAliImageUrl(String(img));
        if (norm) images.push(norm);
      }
    }
    if (!price?.value) {
      const ldOffer = Array.isArray(ldProduct.offers)
        ? ldProduct.offers[0]
        : ldProduct.offers;
      if (ldOffer?.price) {
        const parsed = parsePrice(String(ldOffer.price), ldOffer.priceCurrency);
        if (parsed.value) {
          price.raw =
            price.raw ?? `${parsed.currency ?? "BRL"} ${parsed.value}`;
          price.value = parsed.value;
          price.currency = parsed.currency ?? price.currency;
        }
      }
    }
  }

  // De-dup e limpeza final
  const uniqueImages = uniq(images).filter(Boolean);

  return {
    title,
    description: description || undefined,
    images: uniqueImages,
    url,
    source: "AliExpress",
    price: price.value ? price : undefined,
    estimatedTax: estimatedTax.value ? estimatedTax : undefined,
  };
}

/**
 * Extrai o preço com múltiplos fallbacks:
 * - spans com classes ofuscadas (contains "price" e "current")
 * - meta tags og:price:amount / product:price:amount / itemprop=price
 * - variações com "activity" price
 */
function extractPrice($: cheerio.CheerioAPI): Money {
  const out: Money = {};

  const candidates = [
    // Classes ofuscadas comuns
    'span[class*="price"][class*="current"]',
    'div[class*="price"] span[class*="current"]',
    // Activity price / promotional
    'span[class*="activity"][class*="price"]',
    // Outros seletor(es) soltos
    'span[class^="price-"]',
  ];

  for (const sel of candidates) {
    const txt = $(sel).first().text().trim();
    if (txt) {
      const parsed = parsePrice(txt);
      if (parsed.value) return parsed;
      out.raw = out.raw ?? txt;
    }
  }

  // Meta tags
  const metaAmount =
    $('meta[property="og:product:price:amount"]').attr("content") ||
    $('meta[property="product:price:amount"]').attr("content") ||
    $('meta[property="og:price:amount"]').attr("content") ||
    $('meta[itemprop="price"]').attr("content");
  const metaCurrency =
    $('meta[property="og:product:price:currency"]').attr("content") ||
    $('meta[property="product:price:currency"]').attr("content") ||
    $('meta[property="og:price:currency"]').attr("content") ||
    $('meta[itemprop="priceCurrency"]').attr("content");

  if (metaAmount) {
    const parsed = parsePrice(metaAmount, metaCurrency);
    if (parsed.value) return parsed;
  }

  return out;
}

/**
 * Extrai imposto estimado do trecho:
 * <a class="vat-installment--item--...">Compra internacional, +R$13,84 em impostos estimados</a>
 */
function extractEstimatedTax($: cheerio.CheerioAPI): Money {
  const out: Money = {};

  // Tenta por classe base (parte estável do nome)
  const taxNode =
    $('a[class*="vat-installment--item"]').first() ||
    $('div[class*="vat-installment--item"]').first();

  const txt = taxNode.text().replace(/\s+/g, " ").trim();
  if (txt) {
    // Extrai algo como +R$13,84
    const m = txt.match(/([+\-]?)\s*(R\$|US\$|\$|€|£)\s*([\d.,]+)/i);
    if (m) {
      const symbol = m[2];
      const val = m[3];
      const parsed = parsePrice(`${symbol}${val}`);
      if (parsed.value) return parsed;
      out.raw = m[0];
    } else {
      out.raw = txt;
    }
  }
  return out;
}

/**
 * Extrai imagens priorizando:
 * - <picture><source srcset="..."> -> pega a maior resolução
 * - <img srcset="..."> idem
 * - <img src|data-src|image-src|data-image>
 * - fallback em <script> com URLs da CDN
 */
function extractImages($: cheerio.CheerioAPI): string[] {
  const imgs: string[] = [];

  // 1) source[srcset] (comumente as maiores)
  $("picture source[srcset]").each((_, el) => {
    const srcset = $(el).attr("srcset");
    if (srcset) {
      const best = pickLargestFromSrcset(srcset);
      const norm = normalizeAliImageUrl(best);
      if (norm) imgs.push(norm);
    }
  });

  // 2) img[srcset]
  if (imgs.length === 0) {
    $("img[srcset]").each((_, el) => {
      const srcset = $(el).attr("srcset");
      if (srcset) {
        const best = pickLargestFromSrcset(srcset);
        const norm = normalizeAliImageUrl(best);
        if (norm) imgs.push(norm);
      }
    });
  }

  // 3) img com possíveis atributos de lazy
  if (imgs.length === 0) {
    $("img[src], img[data-src], img[image-src], img[data-image]").each(
      (_, el) => {
        const src =
          $(el).attr("src") ||
          $(el).attr("data-src") ||
          $(el).attr("image-src") ||
          $(el).attr("data-image");

        if (src && !src.startsWith("data:")) {
          const norm = normalizeAliImageUrl(src);
          if (norm) imgs.push(norm);
        }
      },
    );
  }

  // 4) Fallback em scripts: procurar URLs da CDN
  if (imgs.length === 0) {
    const scripts = $("script").toArray();
    for (const s of scripts) {
      const content = $(s).html() || "";
      const matches = content.match(
        /https?:\/\/[^"'\s)]+?\.(?:jpg|jpeg|png|webp)(?:\?[^"'\s)]*)?/gi,
      );
      if (matches) {
        for (const u of matches) {
          if (isAliCdn(u)) {
            const norm = normalizeAliImageUrl(u);
            if (norm) imgs.push(norm);
          }
        }
      }
    }
  }

  return imgs;
}

/**
 * Escolhe a maior imagem de um srcset (por largura ou densidade).
 */
function pickLargestFromSrcset(srcset: string): string {
  // Exemplo: "https://... 200w, https://... 400w" ou "https://... 1x, https://... 2x"
  let bestUrl = "";
  let bestScore = -1;

  srcset.split(",").forEach((part) => {
    const seg = part.trim().split(/\s+/);
    const url = seg[0];
    const descriptor = seg[1] || "";

    let score = 1;
    const w = descriptor.match(/(\d+)w$/);
    const x = descriptor.match(/(\d+(?:\.\d+)?)x$/);

    if (w) score = parseInt(w[1], 10);
    else if (x)
      score = parseFloat(x[1]) * 1000; // x2 > x1
    else score = 1;

    if (score > bestScore) {
      bestScore = score;
      bestUrl = url;
    }
  });

  return bestUrl;
}

/**
 * Normaliza URLs da Ali CDN:
 * - adiciona https: quando começa com //
 * - remove sufixos problemáticos comuns (ex.: ".jpg_Q90.jpg_.webp" -> ".jpg_Q90.jpg")
 * - mantém apenas domínios da Ali (evita thumbs de terceiros)
 */
function normalizeAliImageUrl(u: string | undefined | null): string | null {
  if (!u) return null;
  let url = u.trim();

  if (url.startsWith("//")) url = "https:" + url;
  if (!/^https?:\/\//i.test(url)) return null;

  // Somente domínios conhecidos da Ali
  if (!isAliCdn(url)) return null;

  // Remove o sufixo "_.webp" ao final (comum em thumbs) mantendo a melhor versão JPEG/PNG já apontada
  // Ex.: .../image.jpg_Q90.jpg_.webp -> .../image.jpg_Q90.jpg
  url = url.replace(/(\.(?:jpg|jpeg|png))_[^/?#]+\.webp$/i, "$1");

  // Algumas variações de tamanho: .../image_120x120.jpg -> preferir original quando só trocar o pattern simples
  url = url.replace(/_(\d+x\d+)(?=\.(?:jpg|jpeg|png|webp)(?:[?#]|$))/i, "");

  return url;
}

function isAliCdn(url: string): boolean {
  try {
    const h = new URL(url).hostname;
    return (
      /(ae0[1-9]|ae1[0-9]|ae|img|gdp)\.alicdn\.com$/i.test(h) ||
      /alicdn\.com$/i.test(h)
    );
  } catch {
    return false;
  }
}

function uniq<T>(arr: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of arr) {
    const key = String(item);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(item);
    }
  }
  return out;
}

function safeParseJSON(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function parsePrice(raw: string, currencyFromMeta?: string): Money {
  const out: Money = { raw };

  let currency = currencyFromMeta;
  if (!currency) {
    if (raw.includes("R$")) currency = "BRL";
    else if (raw.match(/\bUSD\b|US\$/i)) currency = "USD";
    else if (raw.includes("€")) currency = "EUR";
    else if (raw.includes("£")) currency = "GBP";
  }

  // Padrões: "R$27,54", "US$ 12.99", "$12.99"
  const m = raw.match(/([\d.,]+)/);
  if (m) {
    // Heurística PT-BR: se tem vírgula e ponto, assume pt-BR; se só vírgula, pt-BR; se só ponto, en-US
    const numStr = m[1];
    let value: number | null = null;
    if (numStr.includes(",") && numStr.includes(".")) {
      // Ex.: 1.234,56 -> 1234.56
      value = Number(numStr.replace(/\./g, "").replace(",", "."));
    } else if (numStr.includes(",")) {
      // Ex.: 27,54 -> 27.54
      value = Number(numStr.replace(",", "."));
    } else {
      // Ex.: 27.54
      value = Number(numStr);
    }
    if (!Number.isNaN(value)) out.value = value;
  }

  if (currency) out.currency = currency;
  return out;
}
