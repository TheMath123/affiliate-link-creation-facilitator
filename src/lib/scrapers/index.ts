import { scrapeMercadoLivre } from "./mercado-livre";
import { scrapeAliExpress } from "./aliexpress";
import { scrapeShopee } from "./shopee";

export async function scrapeProduct(url: string) {
  // Detect source from URL
  if (url.includes("mercadolivre.com") || url.includes("mercadolibre.com")) {
    return scrapeMercadoLivre(url);
  } else if (url.includes("aliexpress.com")) {
    return scrapeAliExpress(url);
  } else if (url.includes("shopee.")) {
    return scrapeShopee(url);
  } else {
    throw new Error(
      "URL não suportada. Use Mercado Livre, AliExpress ou Shopee.",
    );
  }
}
