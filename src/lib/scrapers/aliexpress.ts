import * as cheerio from "cheerio"

export async function scrapeAliExpress(url: string) {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    },
  })

  if (!response.ok) {
    throw new Error("Falha ao acessar a página do AliExpress")
  }

  const html = await response.text()
  const $ = cheerio.load(html)

  // Extract title
  const title =
    $('h1[data-pl="product-title"]').first().text().trim() ||
    $(".product-title-text").first().text().trim() ||
    $("h1").first().text().trim()

  // Extract description
  const description =
    $(".product-description").first().text().trim() || $(".detail-desc-decorate-richtext").first().text().trim()

  // Extract images
  const images: string[] = []

  // Try different selectors for images
  $(".images-view-item img").each((_, el) => {
    const src = $(el).attr("src") || $(el).attr("data-src")
    if (src) {
      // Convert to higher quality
      const highQualitySrc = src.replace(/_\d+x\d+\./, "_").replace(/\.jpg_.*$/, ".jpg")
      images.push(highQualitySrc.startsWith("//") ? `https:${highQualitySrc}` : highQualitySrc)
    }
  })

  // Alternative selector
  if (images.length === 0) {
    $('img[class*="magnifier"]').each((_, el) => {
      const src = $(el).attr("src") || $(el).attr("data-src")
      if (src) {
        images.push(src.startsWith("//") ? `https:${src}` : src)
      }
    })
  }

  // Try to find images in script tags (AliExpress often loads images via JS)
  if (images.length === 0) {
    const scripts = $("script").toArray()
    for (const script of scripts) {
      const content = $(script).html() || ""
      const imageMatches = content.match(/https?:\/\/[^"'\s]+\.jpg/g)
      if (imageMatches) {
        images.push(...imageMatches.filter((img) => img.includes("ae01.alicdn.com") || img.includes("ae04.alicdn.com")))
      }
    }
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
    source: "AliExpress" as const,
  }
}
