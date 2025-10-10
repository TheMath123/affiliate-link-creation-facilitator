import type { ScrapedProduct } from "@/types/product";
import { extractProductWithGemini } from "@/lib/ai/gemini";

const REQUEST_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117 Safari/537.36",
  "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
};

export async function scrapeMercadoLivre(url: string): Promise<ScrapedProduct> {
  const response = await fetch(url, { headers: REQUEST_HEADERS });

  if (!response.ok) {
    throw new Error("Falha ao acessar a página do Mercado Livre");
  }

  const html = await response.text();

  return extractProductWithGemini({
    url,
    source: "Mercado Livre",
    html,
    instructions:
      "Extraia dados exatamente como aparecem no site Mercado Livre Brasil. Se preço estiver em destaque, inclua com símbolo monetário. Ignore perguntas e avaliações.",
  });
}
