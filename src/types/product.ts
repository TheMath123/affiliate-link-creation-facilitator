export interface ScrapedProduct {
  title: string
  description?: string
  images: string[]
  url: string
  source: "Mercado Livre" | "AliExpress" | "Desconhecido"
}
