import { log } from "@logtail/next";
import * as cheerio from "cheerio";

function resolveUrl(candidate: string | undefined, base: string) {
  if (!candidate) return undefined;
  try {
    const clean = candidate.trim().replace(/^["']|["']$/g, "");
    return new URL(clean, base).toString();
  } catch {
    return undefined;
  }
}

// Escolhe o maior item do srcset (por 2x ou por largura em w)
function chooseBestFromSrcset(srcset: string | undefined, base: string) {
  if (!srcset) return undefined;
  const candidates = srcset
    .split(",")
    .map((raw) => raw.trim())
    .filter(Boolean)
    .map((part) => {
      const [u, d] = part.split(/\s+/);
      let score = 0;
      if (d) {
        const m = d.match(/^(\d+(?:\.\d+)?)(x|w)$/i);
        if (m) {
          const val = parseFloat(m[1]);
          const unit = m[2].toLowerCase();
          // Damos mais peso ao "x" (densidade) para ordenar corretamente
          score = unit === "x" ? val * 10000 : val;
        }
      }
      return { url: u, score };
    })
    .sort((a, b) => b.score - a.score);

  const best = candidates[0];
  return best ? resolveUrl(best.url, base) : undefined;
}

// Para imagens da galeria do Mercado Livre, priorize data-zoom > srcset > src
function getMlImageUrl($: cheerio.CheerioAPI, el: any, base: string) {
  const $el = $(el);

  // 1) Melhor URL costuma estar em data-zoom
  const zoom = $el.attr("data-zoom");
  if (zoom) {
    const resolved = resolveUrl(zoom, base);
    if (resolved) return resolved;
  }

  // 2) Depois, pegue o maior item do srcset
  const fromSrcset = chooseBestFromSrcset(
    $el.attr("srcset") || $el.attr("data-srcset"),
    base,
  );
  if (fromSrcset) return fromSrcset;

  // 3) Por fim, caia para src (ou variantes lazy)
  const src =
    $el.attr("src") ||
    $el.attr("data-src") ||
    $el.attr("data-original") ||
    $el.attr("data-lazy");
  if (src) {
    const resolved = resolveUrl(src, base);
    if (resolved) return resolved;
  }

  return undefined;
}

// Utilitário para normalizar texto (remover espaços excessivos/linhas)
function normalizeText(input?: string) {
  if (!input) return "";
  return input
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

// Tenta extrair descrição do JSON-LD (Product)
function extractDescriptionFromLdJson($: cheerio.CheerioAPI) {
  let desc: string | undefined;

  function getDescFromObj(node: any): string | undefined {
    if (!node) return undefined;

    if (Array.isArray(node)) {
      for (const item of node) {
        const d = getDescFromObj(item);
        if (d) return d;
      }
      return undefined;
    }

    if (typeof node === "object") {
      const t = node["@type"];
      const isProduct =
        (typeof t === "string" && t.toLowerCase() === "product") ||
        (Array.isArray(t) &&
          t.some(
            (x) => typeof x === "string" && x.toLowerCase() === "product",
          ));

      if (
        isProduct &&
        typeof node.description === "string" &&
        node.description.trim()
      ) {
        return node.description;
      }

      // Alguns sites colocam as coisas em @graph ou mainEntity
      const possible = ["@graph", "mainEntity", "item"];
      for (const key of possible) {
        if (key in node) {
          const d = getDescFromObj(node[key]);
          if (d) return d;
        }
      }

      // Busca genérica em chaves
      for (const k of Object.keys(node)) {
        const v = (node as any)[k];
        const d = getDescFromObj(v);
        if (d) return d;
      }
    }
    return undefined;
  }

  $('script[type="application/ld+json"]').each((_, el) => {
    if (desc) return; // já achou
    try {
      const raw = $(el).contents().text().trim();
      if (!raw) return;
      const json = JSON.parse(raw);
      const found = getDescFromObj(json);
      if (found && !desc) {
        desc = normalizeText(found);
      }
    } catch {
      // ignora JSON-LD inválido
    }
  });

  return desc || "";
}

// Extrai a descrição do DOM (seletores comuns no ML)
function extractDescriptionFromDom($: cheerio.CheerioAPI) {
  const selectors = [
    ".ui-pdp-description__content",
    ".ui-pdp-description",
    ".item-description__text", // versões antigas
    "#description", // fallback genérico
  ];

  for (const sel of selectors) {
    const $box = $(sel).first();
    if ($box.length) {
      // Tenta montar com p/li para preservar estrutura
      const parts: string[] = [];
      $box.find("p, li").each((_, el) => {
        const t = $(el).text().trim();
        if (t) parts.push(t);
      });

      let text = parts.length ? parts.join("\n") : $box.text();
      text = normalizeText(text);

      // evita textos muito curtos ou genéricos
      if (text && text.length > 30) return text;
    }
  }

  return "";
}

// Fallback meta tags
function extractDescriptionFallbackMeta($: cheerio.CheerioAPI) {
  const metaDesc =
    $('meta[name="description"]').attr("content") ||
    $('meta[property="og:description"]').attr("content") ||
    $('meta[name="twitter:description"]').attr("content");
  return normalizeText(metaDesc || "");
}

export async function scrapeMercadoLivre(url: string) {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117 Safari/537.36",
      "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    },
  });

  if (!response.ok) {
    throw new Error("Falha ao acessar a página do Mercado Livre");
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  log.info(JSON.stringify($.parseHTML()));

  // Título
  const title =
    $("h1.ui-pdp-title").first().text().trim() ||
    $(".item-title__primary").first().text().trim() ||
    $("meta[property='og:title']").attr("content")?.trim() ||
    "";

  // Descrição (JSON-LD -> DOM -> meta)
  let description =
    extractDescriptionFromLdJson($) ||
    extractDescriptionFromDom($) ||
    extractDescriptionFallbackMeta($);

  const images: string[] = [];

  // 1) Foque somente nas imagens grandes da galeria para evitar thumbnails
  $(".ui-pdp-gallery__wrapper figure.ui-pdp-gallery__figure img").each(
    (_, el) => {
      const candidate = getMlImageUrl($, el, url);
      if (candidate) images.push(candidate);
    },
  );

  // 2) Fallback: caso a estrutura varie, tente outros seletores, mas pule miniaturas
  if (images.length === 0) {
    $("figure.ui-pdp-gallery__figure img, img.ui-pdp-image").each((_, el) => {
      const $el = $(el);

      // Evita thumbnails típicas (44x44 etc)
      const w = Number($el.attr("width")) || 0;
      const h = Number($el.attr("height")) || 0;
      if ((w && w <= 60) || (h && h <= 60)) return;

      const candidate = getMlImageUrl($, el, url);
      if (candidate) images.push(candidate);
    });
  }

  // 3) Limpe miniaturas explícitas (padrão “/D_Q_”) e dedupe
  const cleaned = images
    .filter((u) => !/\/D_Q_/.test(u)) // remove thumbs pequenas
    .filter(Boolean);
  const uniqueImages = [...new Set(cleaned)];

  // 4) Fallback: og:image e similares
  if (uniqueImages.length === 0) {
    const og =
      $("meta[property='og:image']").attr("content") ||
      $("meta[name='twitter:image']").attr("content");
    const linkImg = $("link[rel='image_src']").attr("href");
    const resolvedOg = resolveUrl(og, url);
    const resolvedLink = resolveUrl(linkImg, url);
    if (resolvedOg) uniqueImages.push(resolvedOg);
    else if (resolvedLink) uniqueImages.push(resolvedLink);
  }

  return {
    title,
    description,
    images: uniqueImages,
    url,
    source: "Mercado Livre" as const,
  };
}
