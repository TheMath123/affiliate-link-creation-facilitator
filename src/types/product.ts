export interface ScrapedProduct {
  title: string;
  description?: string;
  price?: number | string;
  estimatedTax?: string | string;
  images: string[];
  url: string;
  source: "Mercado Livre" | "AliExpress" | "Desconhecido";
}
