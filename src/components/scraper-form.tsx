"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Search } from "lucide-react"
import { ProductResult } from "@/components/product-result"
import type { ScrapedProduct } from "@/types/product"
import { toast } from "sonner"
import { scrapeProduct } from "@/actions/scraper"

interface ScraperFormProps {
  selectedProduct?: ScrapedProduct | null
  onProductChange?: (product: ScrapedProduct | null) => void
}

export function ScraperForm({ selectedProduct, onProductChange }: ScraperFormProps) {
  const [url, setUrl] = useState("")
  const [loading, setLoading] = useState(false)
  const [product, setProduct] = useState<ScrapedProduct | null>(null)

  useEffect(() => {
    if (selectedProduct) {
      setProduct(selectedProduct)
      setUrl(selectedProduct.url)
    }
  }, [selectedProduct])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!url.trim()) {
      toast.error("URL obrigatória: Por favor, insira uma URL válida")
      return
    }

    setLoading(true)
    setProduct(null)

    const res = await scrapeProduct(url)

    if (!res.success) {
      toast.error(res.error)
      setLoading(false)
      return
    }

    const data = res.data
    console.log('data', data);
    setProduct(data)
    onProductChange?.(data)

    // Save to localStorage for history
    const history = JSON.parse(localStorage.getItem("scraper-history") || "[]")
    history.unshift({ ...data, scrapedAt: new Date().toISOString() })
    localStorage.setItem("scraper-history", JSON.stringify(history.slice(0, 10)))

    window.dispatchEvent(new Event("history-updated"))

    toast.success("Sucesso! Produto extraído com sucesso")
    setLoading(false)
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Extrair Produto</CardTitle>
          <CardDescription>Cole a URL do produto do Mercado Livre ou AliExpress</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              type="url"
              placeholder="https://produto.mercadolivre.com.br/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={loading}
              className="flex-1"
            />
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Extraindo...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Extrair
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {product && <ProductResult product={product} />}
    </div>
  )
}
