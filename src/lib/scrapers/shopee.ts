import { extractProductWithGemini } from "@/lib/ai/gemini";
import type { ScrapedProduct } from "@/types/product";

const REQUEST_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
};

const SHOPEE_IMAGE_HOSTS = ["cf.shopee", "susercontent.com", "shopee"];

type ShopeeApiItem = {
  name?: string;
  description?: string;
  images?: string[];
  image?: string[];
  price?: number;
  price_before_discount?: number;
  price_min?: number;
  price_max?: number;
  price_min_before_discount?: number;
  price_max_before_discount?: number;
  currency?: string;
};

type ShopeeIds = {
  shopId: string;
  itemId: string;
};

export async function scrapeShopee(url: string): Promise<ScrapedProduct> {
  const response = await fetch(url, { headers: REQUEST_HEADERS });
  if (!response.ok) {
    throw new Error("Falha ao acessar a página da Shopee");
  }

  const rawHtml = await response.text();
  const decodedHtml = decodeShopeeHtml(rawHtml);

  const [geminiProduct, apiItem] = await Promise.all([
    extractProductWithGemini({
      url,
      source: "Shopee",
      html: rawHtml,
      instructions:
        "Extraia dados oficiais do produto na Shopee (versão brasileira). Retorne price e estimatedTax como strings com símbolo de moeda (ex.: 'R$ 199,90'). Caso impostos não apareçam, use null.",
    }),
    fetchShopeeApiItem(url).catch(() => null),
  ]);

  const fallbackImages = extractShopeeImages(decodedHtml);
  const imagesFromApi = apiItem ? normalizeShopeeImages(apiItem) : [];

  const combinedImages = dedupe([
    ...(geminiProduct.images ?? []),
    ...imagesFromApi,
    ...fallbackImages,
  ]).filter(isLikelyShopeeImage);

  const description =
    geminiProduct.description ||
    normalizeWhitespace(apiItem?.description) ||
    extractDescriptionFromHtml(decodedHtml);

  const title =
    geminiProduct.title ||
    (apiItem?.name ? apiItem.name.trim() : "") ||
    extractTitleFromHtml(decodedHtml);

  const fallbackPrice = extractShopeePrice(decodedHtml);
  const fallbackTax = extractShopeeTax(decodedHtml);
  const apiPrice = apiItem ? formatShopeePriceRange(apiItem) : undefined;

  return {
    ...geminiProduct,
    title,
    description: description || undefined,
    images: combinedImages,
    price: pickCurrency(geminiProduct.price, apiPrice, fallbackPrice),
    estimatedTax: pickCurrency(
      geminiProduct.estimatedTax,
      undefined,
      fallbackTax,
    ),
    source: "Shopee",
  };
}

async function fetchShopeeApiItem(url: string): Promise<ShopeeApiItem | null> {
  const ids = extractShopeeIds(url);
  if (!ids) return null;

  const origin = new URL(url).origin;
  const endpoints = [
    `${origin}/api/v4/item/get?itemid=${ids.itemId}&shopid=${ids.shopId}`,
    `${origin}/api/v4/pdp/get_pc?itemid=${ids.itemId}&shopid=${ids.shopId}`,
    `${origin}/api/v2/item/get?itemid=${ids.itemId}&shopid=${ids.shopId}`,
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        headers: {
          ...REQUEST_HEADERS,
          Accept: "application/json, text/plain, */*",
          Referer: url,
        },
      });

      if (!response.ok) continue;
      const json = await response.json();
      const item = extractItemFromApiResponse(json);
      if (item) {
        return item;
      }
    } catch {
      continue;
    }
  }

  return null;
}

function extractShopeeIds(url: string): ShopeeIds | null {
  try {
    const parsed = new URL(url);
    const slugMatch = parsed.pathname.match(/i\.(\d+)\.(\d+)/);
    if (slugMatch) {
      return { shopId: slugMatch[1], itemId: slugMatch[2] };
    }

    const segments = parsed.pathname.split("/").filter(Boolean);
    const productIdx = segments.findIndex((segment) => segment === "product");
    if (productIdx >= 0) {
      const shopId = segments[productIdx + 1];
      const itemId = segments[productIdx + 2];
      if (shopId && itemId) {
        return { shopId, itemId };
      }
    }
  } catch {
    return null;
  }

  return null;
}

function extractItemFromApiResponse(payload: unknown): ShopeeApiItem | null {
  if (!payload || typeof payload !== "object") return null;

  const root = payload as Record<string, unknown>;
  const data = root.data ?? payload;
  if (data && typeof data === "object") {
    const typed = data as Record<string, unknown>;

    if (typed.item && typeof typed.item === "object") {
      return typed.item as ShopeeApiItem;
    }

    if (typed.product && typeof typed.product === "object") {
      return typed.product as ShopeeApiItem;
    }

    if (typed.item_info && typeof typed.item_info === "object") {
      return typed.item_info as ShopeeApiItem;
    }

    if (typed.data && typeof typed.data === "object") {
      return extractItemFromApiResponse(typed.data);
    }

    return typed as ShopeeApiItem;
  }

  return null;
}

function extractShopeeImages(html: string): string[] {
  const bucket = new Set<string>();

  for (const candidate of extractImageUrls(html)) {
    const normalized = normalizeShopeeImageUrl(candidate);
    if (normalized) bucket.add(normalized);
  }

  for (const id of extractImageIds(html)) {
    const normalized = normalizeShopeeImageId(id);
    if (normalized) bucket.add(normalized);
  }

  const nextData = extractNextData(html);
  if (nextData) {
    collectImagesFromJson(nextData, bucket);
  }

  for (const img of extractImagesFromJsonLd(html)) {
    const normalized =
      normalizeShopeeImageUrl(img) || normalizeShopeeImageId(img);
    if (normalized) bucket.add(normalized);
  }

  return Array.from(bucket);
}

function extractImageUrls(html: string): string[] {
  const urls: string[] = [];

  const directUrlRegex =
    /https?:\/\/[^\s"'()]+?(?:\.(?:jpg|jpeg|png|webp))(?:\?[^\s"'()]*)?/gi;
  for (const match of html.matchAll(directUrlRegex)) {
    urls.push(decodeHtmlEntities(match[0]));
  }

  const imgAttrRegex =
    /<img[^>]+?(?:src|data-src|data-original|data-image|data-lazy)=["']([^"'>]+)["'][^>]*>/gi;
  for (const match of html.matchAll(imgAttrRegex)) {
    urls.push(decodeHtmlEntities(match[1]));
  }

  const bgRegex = /background-image\s*:\s*url\(([^)]+)\)/gi;
  for (const match of html.matchAll(bgRegex)) {
    const raw = match[1].replace(/^['"]|['"]$/g, "");
    urls.push(decodeHtmlEntities(raw));
  }

  return urls;
}

function extractImageIds(html: string): string[] {
  const ids: string[] = [];

  const arrayRegex = /"images"\s*:\s*(\[[^\]]+\])/gi;
  for (const match of html.matchAll(arrayRegex)) {
    try {
      const parsed = JSON.parse(match[1]) as string[];
      ids.push(...parsed);
    } catch {
      continue;
    }
  }

  const singleRegex = /"image"\s*:\s*"([^\"]+)"/gi;
  for (const match of html.matchAll(singleRegex)) {
    ids.push(match[1]);
  }

  return ids;
}

function extractNextData(html: string): unknown {
  const match = html.match(
    /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/i,
  );
  if (!match) return null;

  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

function collectImagesFromJson(node: unknown, bucket: Set<string>) {
  if (!node) return;

  if (typeof node === "string") {
    const normalized =
      normalizeShopeeImageUrl(node) || normalizeShopeeImageId(node);
    if (normalized) bucket.add(normalized);
    return;
  }

  if (Array.isArray(node)) {
    for (const item of node) {
      collectImagesFromJson(item, bucket);
    }
    return;
  }

  if (typeof node === "object") {
    const typed = node as Record<string, unknown>;
    const preferredKeys = ["image", "images", "cover", "coverImage"];

    for (const key of preferredKeys) {
      if (key in typed) {
        collectImagesFromJson(typed[key], bucket);
      }
    }

    for (const value of Object.values(typed)) {
      collectImagesFromJson(value, bucket);
    }
  }
}

function extractImagesFromJsonLd(html: string): string[] {
  const results: string[] = [];
  const scriptRegex =
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  for (const match of html.matchAll(scriptRegex)) {
    const rawContent = decodeHtmlEntities(match[1].trim());
    if (!rawContent) continue;

    try {
      const json = JSON.parse(rawContent);
      const bucket = new Set<string>();
      collectImagesFromJson(json, bucket);
      results.push(...bucket);
    } catch {
      continue;
    }
  }

  return results;
}

function normalizeShopeeImages(item: ShopeeApiItem): string[] {
  const ids: string[] = [];

  if (Array.isArray(item.images)) {
    ids.push(...item.images);
  }

  if (Array.isArray(item.image)) {
    ids.push(...item.image);
  } else if (typeof item.image === "string") {
    ids.push(item.image);
  }

  const bucket = new Set<string>();
  for (const id of ids) {
    const normalized = normalizeShopeeImageId(id);
    if (normalized) bucket.add(normalized);
  }

  collectImagesFromJson(item, bucket);

  return Array.from(bucket);
}

function normalizeShopeeImageUrl(url: string): string | null {
  if (!url) return null;
  let normalized = url.trim();
  if (!normalized) return null;

  if (normalized.startsWith("//")) {
    normalized = `https:${normalized}`;
  }

  if (!/^https?:\/\//i.test(normalized)) {
    return normalizeShopeeImageId(normalized);
  }

  normalized = normalized.replace(
    /_(tn|thumbnail)(?=\.[a-z]{3,4}(?:[?#]|$))/i,
    "",
  );
  normalized = normalized.replace(/_(\d+x\d+)(?=\.[a-z]{3,4}(?:[?#]|$))/i, "");

  return normalized;
}

function normalizeShopeeImageId(imageId?: string | null): string | null {
  if (!imageId) return null;
  let trimmed = imageId.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("//")) {
    trimmed = `https:${trimmed}`;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return normalizeShopeeImageUrl(trimmed);
  }

  if (trimmed.startsWith("file/")) {
    trimmed = trimmed.slice(5);
  }

  const hasVariantSuffix =
    trimmed.includes("@") || /\.[a-z]{3,4}(?:[?#]|$)/i.test(trimmed);
  if (!hasVariantSuffix) {
    trimmed = `${trimmed}@resize_w900_nl.webp`;
  }

  return normalizeShopeeImageUrl(
    `https://down-br.img.susercontent.com/file/${trimmed}`,
  );
}

function pickCurrency(
  current: ScrapedProduct["price" | "estimatedTax"],
  primaryFallback?: string | null,
  secondaryFallback?: string | null,
) {
  const currentValue = normalizeCurrency(current);
  if (currentValue !== undefined) return currentValue;

  const primaryValue = normalizeCurrency(primaryFallback);
  if (primaryValue !== undefined) return primaryValue;

  const secondaryValue = normalizeCurrency(secondaryFallback);
  if (secondaryValue !== undefined) return secondaryValue;

  return undefined;
}

function normalizeCurrency(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === "string") {
    const normalized = sanitizeCurrency(value);
    return normalized || undefined;
  }

  return undefined;
}

function sanitizeCurrency(value: string, code?: string) {
  const normalized = value
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .replace(/(R\$|US\$|€|£|¥|\$)\s*/gi, (match) => `${match.trim()} `)
    .trim();

  if (!normalized) return "";
  if (/(R\$|US\$|€|£|¥|\$)/.test(normalized)) {
    return normalized;
  }

  const signMatch = normalized.match(/^([+-])/);
  const sign = signMatch ? signMatch[1] : "";
  const numberPart = sign ? normalized.slice(1).trim() : normalized;
  if (!numberPart) return "";

  const symbol = symbolForCurrency(code);
  return sign ? `${sign}${symbol} ${numberPart}` : `${symbol} ${numberPart}`;
}

function symbolForCurrency(code?: string) {
  if (!code) return "R$";
  const upper = code.toUpperCase();
  const symbols: Record<string, string> = {
    BRL: "R$",
    USD: "US$",
    EUR: "€",
    GBP: "£",
    JPY: "¥",
    CNY: "¥",
    KRW: "₩",
    THB: "฿",
    VND: "₫",
    IDR: "Rp",
    PHP: "₱",
    SGD: "S$",
    MXN: "MX$",
    COP: "COP",
  };
  return symbols[upper] ?? upper;
}

function formatAmount(amount: string, currencyCode?: string) {
  const numeric = Number(amount.replace(/,/g, "."));
  if (!Number.isFinite(numeric)) {
    return sanitizeCurrency(amount, currencyCode);
  }

  const symbol = symbolForCurrency(currencyCode);
  const formatted = numeric.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${symbol} ${formatted}`;
}

function extractShopeePrice(html: string): string | null {
  const amount = matchMetaProperty(html, "og:price:amount");
  const currency = matchMetaProperty(html, "og:price:currency");
  if (amount) {
    return formatAmount(amount, currency ?? undefined);
  }

  const priceMatch = html.match(/"current_price"\s*:\s*([0-9.]+)/i);
  if (priceMatch) {
    const codeMatch = html.match(/"currency"\s*:\s*"([A-Z]{3})"/i)?.[1];
    return formatAmount(priceMatch[1], codeMatch ?? undefined);
  }

  const fallback = html.match(/(R\$|US\$|€|£|¥|\$)\s?[\d.,]+/);
  if (fallback) {
    return sanitizeCurrency(fallback[0]);
  }

  return null;
}

function extractShopeeTax(html: string): string | null {
  const amount = matchMetaProperty(html, "product:tax:amount");
  if (amount) {
    const currency = matchMetaProperty(html, "product:tax:currency");
    return formatAmount(amount, currency ?? undefined);
  }

  const taxMatch = html.match(/"estimated_additional_tax"\s*:\s*([0-9.]+)/i);
  if (taxMatch) {
    const currency = html.match(/"currency"\s*:\s*"([A-Z]{3})"/i)?.[1];
    return formatAmount(taxMatch[1], currency ?? undefined);
  }

  const fallback = html.match(
    /(imposto|taxa|tarifa)[^\n\r]*?(R\$|US\$|€|£|¥|\$)\s?[\d.,]+/i,
  );
  if (fallback) {
    return sanitizeCurrency(fallback[0]);
  }

  return null;
}

function formatShopeePriceRange(item: ShopeeApiItem) {
  const candidates = [
    normalizeShopeePrice(item.price_min ?? item.price, item.currency),
    normalizeShopeePrice(item.price_max ?? item.price, item.currency),
  ].filter(Boolean) as string[];

  if (candidates.length === 0) {
    const fallback = normalizeShopeePrice(
      item.price_min_before_discount ?? item.price_before_discount,
      item.currency,
    );
    return fallback ?? undefined;
  }

  if (candidates.length === 1 || candidates[0] === candidates[1]) {
    return candidates[0];
  }

  return `${candidates[0]} - ${candidates[1]}`;
}

function normalizeShopeePrice(value?: number | null, currency?: string) {
  if (typeof value !== "number") return undefined;
  const currencyCode = currency?.toUpperCase() ?? "BRL";
  const normalized = value / 100000;

  try {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: currencyCode,
      minimumFractionDigits: 2,
    }).format(normalized);
  } catch {
    return `${currencyCode} ${normalized.toFixed(2)}`;
  }
}

function extractTitleFromHtml(html: string) {
  const meta = matchMetaProperty(html, "og:title");
  if (meta) return meta.trim();

  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  return titleMatch ? decodeHtmlEntities(titleMatch[1]).trim() : "";
}

function extractDescriptionFromHtml(html: string) {
  const meta =
    matchMetaName(html, "description") ||
    matchMetaProperty(html, "og:description") ||
    matchMetaProperty(html, "twitter:description");
  return normalizeWhitespace(meta);
}

function matchMetaProperty(html: string, property: string) {
  const regex = new RegExp(
    `<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`,
    "i",
  );
  return html.match(regex)?.[1] ?? null;
}

function matchMetaName(html: string, name: string) {
  const regex = new RegExp(
    `<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`,
    "i",
  );
  return html.match(regex)?.[1] ?? null;
}

function decodeShopeeHtml(html: string) {
  return html
    .replace(/\\u002F/gi, "/")
    .replace(/\\\//g, "/")
    .replace(/\\"/g, '"');
}

function decodeHtmlEntities(value: string) {
  return value.replace(/&amp;/g, "&").replace(/&quot;/g, '"');
}

function normalizeWhitespace(input?: string | null) {
  if (!input) return "";
  return input
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function isLikelyShopeeImage(url: string) {
  try {
    const hostname = new URL(url).hostname;
    return SHOPEE_IMAGE_HOSTS.some((host) => hostname.includes(host));
  } catch {
    return false;
  }
}

function dedupe<T>(values: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const value of values) {
    const key = typeof value === "string" ? value : JSON.stringify(value);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(value);
    }
  }

  return result;
}
