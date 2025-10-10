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

  return extractProductWithGemini({
    url,
    source: "AliExpress",
    html,
    instructions:
      "Identifique informações confiáveis do produto no AliExpress. Priorize valores oficiais do comerciante (preço, impostos) e ignore recomendações/promoções não relacionadas.",
  });
}
