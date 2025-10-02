"use client"

import { useState } from "react"
import { ScraperForm } from "@/components/scraper-form"
import { ScraperHistory } from "@/components/scraper-history"
import type { ScrapedProduct } from "@/types/product"

export function HomeContent() {
  const [selectedProduct, setSelectedProduct] = useState<ScrapedProduct | null>(null)

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-balance">Product Scraper</h1>
          <p className="mt-2 text-muted-foreground text-pretty">
            Extraia informações de produtos do Mercado Livre e AliExpress
          </p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <ScraperForm selectedProduct={selectedProduct} onProductChange={setSelectedProduct} />
          </div>
          <div className="lg:col-span-1">
            <ScraperHistory onSelectProduct={setSelectedProduct} />
          </div>
        </div>
      </main>
    </div>
  )
}
