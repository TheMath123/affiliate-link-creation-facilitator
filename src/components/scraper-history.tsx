"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Trash2, ExternalLink, Eye } from "lucide-react"
import type { ScrapedProduct } from "@/types/product"
import Image from "next/image"

interface HistoryItem extends ScrapedProduct {
  scrapedAt: string
}

interface ScraperHistoryProps {
  onSelectProduct?: (product: ScrapedProduct) => void
}

export function ScraperHistory({ onSelectProduct }: ScraperHistoryProps) {
  const [history, setHistory] = useState<HistoryItem[]>([])

  const loadHistory = () => {
    const stored = localStorage.getItem("scraper-history")
    if (stored) {
      setHistory(JSON.parse(stored))
    }
  }

  useEffect(() => {
    loadHistory()

    // Listen for storage changes
    window.addEventListener("storage", loadHistory)
    window.addEventListener("history-updated", loadHistory)
    return () => {
      window.removeEventListener("storage", loadHistory)
      window.removeEventListener("history-updated", loadHistory)
    }
  }, [])

  const clearHistory = () => {
    localStorage.removeItem("scraper-history")
    setHistory([])
  }

  const removeItem = (index: number) => {
    const newHistory = history.filter((_, i) => i !== index)
    localStorage.setItem("scraper-history", JSON.stringify(newHistory))
    setHistory(newHistory)
  }

  return (
    <Card className="sticky top-4">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Histórico</CardTitle>
            <CardDescription>Últimos produtos extraídos</CardDescription>
          </div>
          {history.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearHistory}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum produto extraído ainda</p>
        ) : (
          <div className="space-y-3">
            {history.map((item, index) => (
              <div
                key={index}
                className="group relative rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors"
              >
                <div className="flex gap-3">
                  {item.images[0] && (
                    <Image
                      width={500}
                      height={500}
                      src={item.images[0] || "/placeholder.svg"}
                      alt={item.title}
                      className="h-16 w-16 rounded object-cover flex-shrink-0 bg-white"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement
                        target.src = "/placeholder.svg?height=64&width=64"
                      }}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium line-clamp-2 text-balance">{item.title}</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      {item.source} • {new Date(item.scrapedAt).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                </div>
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                  {onSelectProduct && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => onSelectProduct(item)}
                      title="Ver detalhes"
                    >
                      <Eye className="h-3 w-3" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => window.open(item.url, "_blank")}
                    title="Abrir link original"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => removeItem(index)}
                    title="Remover do histórico"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
