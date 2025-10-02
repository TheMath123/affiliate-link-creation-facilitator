"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Copy, Check, ExternalLink } from "lucide-react"
import type { ScrapedProduct } from "@/types/product"
import { ImageGallery } from "@/components/image-gallery"
import { toast } from "sonner"

interface ProductResultProps {
  product: ScrapedProduct
}

export function ProductResult({ product }: ProductResultProps) {
  const [copiedTitle, setCopiedTitle] = useState(false)
  const [copiedDescription, setCopiedDescription] = useState(false)

  const copyToClipboard = async (text: string, type: "title" | "description") => {
    try {
      await navigator.clipboard.writeText(text)

      if (type === "title") {
        setCopiedTitle(true)
        setTimeout(() => setCopiedTitle(false), 2000)
      } else {
        setCopiedDescription(true)
        setTimeout(() => setCopiedDescription(false), 2000)
      }

      toast.success(`Copiado! ${type === "title" ? "Título" : "Descrição"} copiado para a área de transferência`)
    } catch (error) {
      toast.error("Não foi possível copiar")
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <CardTitle className="text-balance">{product.title}</CardTitle>
              <CardDescription className="mt-2 flex items-center gap-2 flex-wrap">
                <span>Fonte: {product.source}</span>
                <span>•</span>
                <a
                  href={product.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  Ver produto original
                  <ExternalLink className="h-3 w-3" />
                </a>
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => copyToClipboard(product.title, "title")}>
              {copiedTitle ? (
                <Check className="h-4 w-4" />
              ) : (
                <>
                  <Copy className="mr-2 h-4 w-4" />
                  Copiar Título
                </>
              )}
            </Button>
          </div>
        </CardHeader>
      </Card>

      {product.description && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Descrição</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(product.description || "", "description")}
              >
                {copiedDescription ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <>
                    <Copy className="mr-2 h-4 w-4" />
                    Copiar
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap text-pretty">{product.description}</p>
          </CardContent>
        </Card>
      )}

      {product.images.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Imagens ({product.images.length})</CardTitle>
            <CardDescription>Clique para visualizar em tamanho completo ou baixar</CardDescription>
          </CardHeader>
          <CardContent>
            <ImageGallery images={product.images} productTitle={product.title} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
