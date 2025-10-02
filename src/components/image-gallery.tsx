"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Download, ChevronLeft, ChevronRight, X } from "lucide-react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { toast } from "sonner"
import Image from "next/image"
interface ImageGalleryProps {
  images: string[]
  productTitle: string
}

export function ImageGallery({ images, productTitle }: ImageGalleryProps) {
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null)

  const downloadImage = async (imageUrl: string, index: number) => {
    try {
      const response = await fetch(imageUrl)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${productTitle.slice(0, 30)}-${index + 1}.jpg`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast.success("Download iniciado! A imagem está sendo baixada")
    } catch (error) {
      toast.error("Não foi possível baixar a imagem")
    }
  }

  const downloadAllImages = async () => {
    for (let i = 0; i < images.length; i++) {
      await downloadImage(images[i], i)
      // Small delay between downloads
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
  }

  const goToPrevious = () => {
    if (selectedImageIndex !== null && selectedImageIndex > 0) {
      setSelectedImageIndex(selectedImageIndex - 1)
    }
  }

  const goToNext = () => {
    if (selectedImageIndex !== null && selectedImageIndex < images.length - 1) {
      setSelectedImageIndex(selectedImageIndex + 1)
    }
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button onClick={downloadAllImages} variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Baixar Todas ({images.length})
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {images.map((image, index) => (
            <div
              key={`image-item-${index}`}
              className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-muted"
            >
              <Image
                width={500}
                height={500}
                src={image || "/placeholder.svg"}
                alt={`${productTitle} - Imagem ${index + 1}`}
                className="h-full w-full object-contain cursor-pointer transition-transform hover:scale-105 bg-white"
                onClick={() => setSelectedImageIndex(index)}
                onError={(e) => {
                  const target = e.target as HTMLImageElement
                  target.src = "/placeholder.svg?height=400&width=400"
                }}
              />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={(e) => {
                    e.stopPropagation()
                    downloadImage(image, index)
                  }}
                >
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Dialog open={selectedImageIndex !== null} onOpenChange={() => setSelectedImageIndex(null)}>
        <DialogContent className="max-w-5xl p-0 gap-0">
          {selectedImageIndex !== null && (
            <div className="relative bg-black">
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 z-10 bg-black/50 hover:bg-black/70 text-white"
                onClick={() => setSelectedImageIndex(null)}
              >
                <X className="h-4 w-4" />
              </Button>

              <div className="flex items-center justify-center min-h-[400px] max-h-[80vh] p-4">
                <Image
                  width={500}
                  height={500}
                  src={images[selectedImageIndex] || "/placeholder.svg"}
                  alt={`${productTitle} - Imagem ${selectedImageIndex + 1}`}
                  className="max-w-full max-h-full object-contain"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    target.src = "/placeholder.svg?height=800&width=800"
                  }}
                />
              </div>

              {/* Navigation buttons */}
              {selectedImageIndex > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white"
                  onClick={goToPrevious}
                >
                  <ChevronLeft className="h-6 w-6" />
                </Button>
              )}

              {selectedImageIndex < images.length - 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white"
                  onClick={goToNext}
                >
                  <ChevronRight className="h-6 w-6" />
                </Button>
              )}

              {/* Image counter and download button */}
              <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white p-4 flex items-center justify-between">
                <span className="text-sm">
                  Imagem {selectedImageIndex + 1} de {images.length}
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => downloadImage(images[selectedImageIndex], selectedImageIndex)}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Baixar Imagem
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
