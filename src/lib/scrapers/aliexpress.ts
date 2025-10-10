import type { ScrapedProduct } from "@/types/product";
import { extractProductWithGemini } from "@/lib/ai/gemini";

const REQUEST_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
};

export async function scrapeAliExpress(url: string): Promise<ScrapedProduct> {
  const response = await fetch(url, { headers: REQUEST_HEADERS });

  if (!response.ok) {
    throw new Error("Falha ao acessar a página do AliExpress");
  }

  const html = await response.text();

  const product = await extractProductWithGemini({
    url,
    source: "AliExpress",
    html,
    instructions:
      "Identifique informações confiáveis do produto no AliExpress. Priorize valores oficiais do comerciante (preço, impostos) e ignore recomendações/promoções não relacionadas. Sempre devolva price e estimatedTax como strings com símbolo de moeda (ex.: 'R$ 123,45'). Se não encontrar impostos estimados, devolva null.",
  });

  const fallbackPrice = extractAliExpressPrice(html);
  const fallbackTax = extractAliExpressTax(html);

  return {
    ...product,
    price: normalizeCurrencyOutput(product.price, fallbackPrice),
    estimatedTax: normalizeCurrencyOutput(product.estimatedTax, fallbackTax),
  };
}

function normalizeCurrencyOutput(
  current: ScrapedProduct["price"],
  fallback: string | null,
) {
  const fallbackSanitized = fallback ? sanitizeCurrency(fallback) : "";

  if (fallbackSanitized) {
    return fallbackSanitized;
  }

  if (typeof current === "number") {
    return current;
  }

  if (typeof current === "string" && hasCurrencyHint(current)) {
    return sanitizeCurrency(current);
  }

  if (typeof current === "string") {
    const sanitized = sanitizeCurrency(current);
    return sanitized || undefined;
  }

  return current ?? undefined;
}

function hasCurrencyHint(value: string) {
  return /(?:R\$|US\$|€|£|¥|\$)/i.test(value);
}

function sanitizeCurrency(value: string) {
  const normalized = value
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .replace(/(R\$|US\$|€|£|¥|\$)\s*/gi, (match) => `${match.trim()} `)
    .trim();

  if (!normalized) return "";

  if (hasCurrencyHint(normalized)) {
    return normalized;
  }

  const signMatch = normalized.match(/^([+-])/);
  const sign = signMatch ? signMatch[1] : "";
  const numeric = sign ? normalized.slice(1).trim() : normalized;
  if (!numeric) return "";

  return sign ? `${sign}R$ ${numeric}` : `R$ ${numeric}`;
}

function extractAliExpressPrice(html: string): string | null {
  const patterns = [
    /"displayPrice"\s*:\s*"([^"]+)"/i,
    /"salePrice"\s*:\s*"([^"]+)"/i,
    /"price"\s*:\s*"([^"]+)"/i,
    /"formattedAmount"\s*:\s*"([^"]+)"/i,
    /"activityPrice"\s*:\s*"([^"]+)"/i,
    />\s*(R\$\s?[\d.,]+)\s*<\/span/,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    const value = match?.[1];
    if (value) {
      const candidate = sanitizeCurrency(value);
      if (candidate) return candidate;
    }
  }

  return null;
}

function extractAliExpressTax(html: string): string | null {
  const patterns = [
    /impostos?\s+estimados?[^+\-R$€£¥]*([+\-]?\s?(?:R\$|US\$|€|£|¥|\$)\s?[\d.,]+)/i,
    /estimated\s+tax[^+\-R$€£¥]*([+\-]?\s?(?:R\$|US\$|€|£|¥|\$)\s?[\d.,]+)/i,
    /taxa\s+estimada[^+\-R$€£¥]*([+\-]?\s?(?:R\$|US\$|€|£|¥|\$)\s?[\d.,]+)/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    const value = match?.[1];
    if (value) {
      const candidate = sanitizeCurrency(value);
      if (candidate) return candidate;
    }
  }

  return null;
}
