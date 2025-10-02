import * as cheerio from "cheerio"

export async function scrapeMercadoLivre(url: string) {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    },
  })

  if (!response.ok) {
    throw new Error("Falha ao acessar a página do Mercado Livre")
  }

  const html = await response.text()
  const $ = cheerio.load(html)

  // Extract title
  const title = $("h1.ui-pdp-title").first().text().trim() || $(".item-title__primary").first().text().trim()

  // Extract description
  const description =
    $(".ui-pdp-description__content").first().text().trim() || $(".item-description__text").first().text().trim()

  // Extract images
  const images: string[] = []

  // Try different selectors for images
  $(".ui-pdp-gallery__figure img").each((_, el) => {
    const src = $(el).attr("src") || $(el).attr("data-src")
    if (src && !src.includes("placeholder")) {
      // Get higher quality image
      const highQualitySrc = src.replace(/-I\.jpg$/, "-O.jpg").replace(/-[A-Z]\.jpg$/, "-O.jpg")
      images.push(highQualitySrc)
    }
  })

  // Alternative selector
  if (images.length === 0) {
    $(".ui-pdp-image").each((_, el) => {
      const src = $(el).attr("src") || $(el).attr("data-src")
      if (src && !src.includes("placeholder")) {
        images.push(src)
      }
    })
  }

  // Remove duplicates
  const uniqueImages = [...new Set(images)]

  if (!title) {
    throw new Error("Não foi possível extrair o título do produto")
  }

  return {
    title,
    description: description || undefined,
    images: uniqueImages,
    url,
    source: "Mercado Livre" as const,
  }
}
