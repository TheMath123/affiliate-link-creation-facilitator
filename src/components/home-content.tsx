"use client"

import { useState } from "react"
import { ScraperForm } from "@/components/scraper-form"
import { ScraperHistory } from "@/components/scraper-history"
import { Button } from "@/components/ui/button"
import type { ScrapedProduct } from "@/types/product"
import { logoutAction } from "@/actions/auth"

export function HomeContent() {
  const [selectedProduct, setSelectedProduct] = useState<ScrapedProduct | null>(null)
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-balance">Product Scraper</h1>
            <p className="mt-2 text-muted-foreground text-pretty">
              Extraia informações de produtos do Mercado Livre, AliExpress e Shopee
            </p>
          </div>
          <form action={logoutAction} className="w-full md:w-auto">
            <Button type="submit" variant="outline" size="sm" className="w-full md:w-auto">
              Sair
            </Button>
          </form>
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
