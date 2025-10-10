import { type NextRequest, NextResponse } from "next/server";
import { scrapeProduct } from "@/lib/scrapers";
import { SESSION_COOKIE_NAME, isValidSessionToken } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    if (!isValidSessionToken(sessionToken)) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

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
