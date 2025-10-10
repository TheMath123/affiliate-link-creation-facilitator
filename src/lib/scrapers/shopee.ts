import type { ScrapedProduct } from "@/types/product";
import { extractProductWithGemini } from "@/lib/ai/gemini";

const REQUEST_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
};

export async function scrapeShopee(url: string): Promise<ScrapedProduct> {
  const response = await fetch(url, { headers: REQUEST_HEADERS });

  if (!response.ok) {
    throw new Error("Falha ao acessar a página da Shopee");
  }

  const html = await response.text();

  const product = await extractProductWithGemini({
    url,
    source: "Shopee",
    html,
    instructions:
      "Extraia dados oficiais do produto na Shopee (versão brasileira). Retorne price e estimatedTax como strings com símbolo de moeda (ex.: 'R$ 199,90'). Caso impostos não apareçam, use null.",
  });

  const fallbackPrice = extractShopeePrice(html);
  const fallbackTax = extractShopeeTax(html);

  return {
    ...product,
    source: "Shopee",
    price: chooseCurrency(product.price, fallbackPrice),
    estimatedTax: chooseCurrency(product.estimatedTax, fallbackTax),
  };
}

function chooseCurrency(
  current: ScrapedProduct["price"],
  fallback: string | null,
) {
  const sanitizedFallback = fallback ? sanitizeCurrency(fallback) : "";
  if (sanitizedFallback) return sanitizedFallback;

  if (typeof current === "number") {
    return current;
  }

  if (typeof current === "string") {
    const sanitized = sanitizeCurrency(current);
    return sanitized || undefined;
  }

  return undefined;
}

function sanitizeCurrency(value: string, currencyCode?: string) {
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
  const numeric = sign ? normalized.slice(1).trim() : normalized;
  if (!numeric) return "";

  const symbol = symbolForCurrency(currencyCode);
  return sign ? `${sign}${symbol} ${numeric}` : `${symbol} ${numeric}`;
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
  const normalizedNumber = Number(amount.replace(/,/g, "."));
  if (!Number.isNaN(normalizedNumber) && Number.isFinite(normalizedNumber)) {
    const symbol = symbolForCurrency(currencyCode);
    const formatted = normalizedNumber.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `${symbol} ${formatted}`;
  }
  return sanitizeCurrency(amount, currencyCode);
}

function matchMetaContent(html: string, property: string) {
  const pattern = new RegExp(
    `<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`,
    "i",
  );
  return html.match(pattern)?.[1] ?? null;
}

function extractShopeePrice(html: string): string | null {
  const amount = matchMetaContent(html, "og:price:amount");
  const currency = matchMetaContent(html, "og:price:currency");
  if (amount) {
    return formatAmount(amount, currency ?? undefined);
  }

  const priceData = html.match(/"current_price"\s*:\s*([0-9.]+)/i);
  if (priceData) {
    const currencyCode = html.match(/"currency"\s*:\s*"([A-Z]{3})"/i)?.[1];
    return formatAmount(priceData[1], currencyCode ?? undefined);
  }

  const fallback = html.match(/(R\$|US\$|€|£|¥|\$)\s?[\d.,]+/);
  if (fallback) {
    return sanitizeCurrency(fallback[0]);
  }

  return null;
}

function extractShopeeTax(html: string): string | null {
  const taxMeta = matchMetaContent(html, "product:tax:amount");
  if (taxMeta) {
    const currency = matchMetaContent(html, "product:tax:currency");
    return formatAmount(taxMeta, currency ?? undefined);
  }

  const jsonTax = html.match(/"estimated_additional_tax"\s*:\s*([0-9.]+)/i);
  if (jsonTax) {
    const currencyCode = html.match(/"currency"\s*:\s*"([A-Z]{3})"/i)?.[1];
    return formatAmount(jsonTax[1], currencyCode ?? undefined);
  }

  const textTax = html.match(
    /(imposto|taxa|tarifa)[^\n\r]*?(R\$|US\$|€|£|¥|\$)\s?[\d.,]+/i,
  );
  if (textTax) {
    return sanitizeCurrency(textTax[0]);
  }

  return null;
}
