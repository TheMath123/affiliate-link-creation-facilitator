import { scrapeMercadoLivre } from "./mercado-livre"
import { scrapeAliExpress } from "./aliexpress"

export async function scrapeProduct(url: string) {
  // Detect source from URL
  if (url.includes("mercadolivre.com") || url.includes("mercadolibre.com")) {
    return scrapeMercadoLivre(url)
  } else if (url.includes("aliexpress.com")) {
    return scrapeAliExpress(url)
  } else {
    throw new Error("URL não suportada. Use Mercado Livre ou AliExpress.")
  }
}
