export interface ScrapedProduct {
  title: string;
  description?: string;
  price?: number | string;
  estimatedTax?: number | string;
  images: string[];
  url: string;
  source: "Mercado Livre" | "AliExpress" | "Shopee" | "Desconhecido";
}
