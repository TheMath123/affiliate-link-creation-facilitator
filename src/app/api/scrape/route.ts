import { type NextRequest, NextResponse } from "next/server";
import { scrapeProduct } from "@/lib/scrapers";

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL é obrigatória" }, { status: 400 });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return NextResponse.json({ error: "URL inválida" }, { status: 400 });
    }

    const product = await scrapeProduct(url);

    return NextResponse.json(product);
  } catch (error) {
    console.error("[v0] Scraping error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro ao fazer scraping do produto",
      },
      { status: 500 },
    );
  }
}
