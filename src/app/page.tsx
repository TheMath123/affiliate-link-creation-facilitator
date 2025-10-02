import { Suspense } from "react"
import { HomeContent } from "@/components/home-content"
import { Toaster } from "@/components/ui/sonner"

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
            <p className="mt-4 text-muted-foreground">Carregando...</p>
          </div>
        </div>
      }
    >
      <HomeContent />
      <Toaster />
    </Suspense>
  )
}
