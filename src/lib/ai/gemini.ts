import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "@/env";
import type { ScrapedProduct } from "@/types/product";

const BASE_PROMPT = `You extract structured product data for affiliate marketing in Brazilian Portuguese.
Return a strict JSON object with the following shape:
{
  "title": string,
  "description": string | null,
  "price": string | null,
  "estimatedTax": string | null,
  "images": string[],
  "url": string,
  "source": string
}
Rules:
- Never hallucinate or fabricate values not present in the HTML.
- Trim whitespace. Use null when a field is absent.
- Prefer prices in the local currency shown in the HTML.
- For images, include only direct absolute URLs of high-quality product photos.
- Keep description concise and faithful to the source.
- Respond ONLY with JSON. No prose, code fences or explanations.`;

const HTML_TRUNCATE_LENGTH = 100_000;

let singleton: GoogleGenerativeAI | null = null;

function getClient() {
  if (!singleton) {
    singleton = new GoogleGenerativeAI(env.GEMINI_API_KEY);
  }
  return singleton;
}

type ExtractArgs = {
  url: string;
  source: ScrapedProduct["source"];
  html: string;
  instructions?: string;
};

function sanitizeHtmlPayload(raw: string) {
  const trimmed = raw.trim();
  return trimmed.length > HTML_TRUNCATE_LENGTH
    ? `${trimmed.slice(0, HTML_TRUNCATE_LENGTH)}\n<!-- truncated -->`
    : trimmed;
}

function ensureScrapedProduct(
  data: unknown,
  context: ExtractArgs,
): ScrapedProduct {
  if (!data || typeof data !== "object") {
    throw new Error("Resposta do Gemini inválida");
  }

  const candidate = data as Partial<ScrapedProduct>;

  const title =
    typeof candidate.title === "string" ? candidate.title.trim() : "";
  if (!title) {
    throw new Error("O modelo não retornou título válido");
  }

  const description =
    typeof candidate.description === "string" && candidate.description.trim()
      ? candidate.description.trim()
      : undefined;

  const price =
    typeof candidate.price === "number"
      ? Number.isFinite(candidate.price)
        ? candidate.price
        : undefined
      : typeof candidate.price === "string" && candidate.price.trim()
        ? candidate.price.trim()
        : undefined;

  const estimatedTax =
    typeof candidate.estimatedTax === "number"
      ? Number.isFinite(candidate.estimatedTax)
        ? candidate.estimatedTax
        : undefined
      : typeof candidate.estimatedTax === "string" &&
          candidate.estimatedTax.trim()
        ? candidate.estimatedTax.trim()
        : undefined;

  const images = Array.isArray(candidate.images)
    ? Array.from(
        new Set(
          candidate.images
            .filter((item): item is string => typeof item === "string")
            .map((item) => item.trim())
            .filter(Boolean),
        ),
      )
    : [];

  return {
    title,
    description,
    price,
    estimatedTax,
    images,
    url:
      candidate.url && typeof candidate.url === "string"
        ? candidate.url.trim()
        : context.url,
    source: context.source,
  };
}

function extractJsonCandidate(text: string) {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("Resposta vazia do Gemini");
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error("Não foi possível interpretar a resposta do Gemini");
  }
}

export async function extractProductWithGemini(
  args: ExtractArgs,
): Promise<ScrapedProduct> {
  const client = getClient();
  const model = client.getGenerativeModel({
    model: "gemini-1.5-flash-latest",
    generationConfig: {
      temperature: 0.2,
      topP: 0.8,
      responseMimeType: "application/json",
    },
  });

  const html = sanitizeHtmlPayload(args.html);
  const prompt = [
    BASE_PROMPT,
    args.instructions || "",
    `Fonte: ${args.source}`,
    `URL do produto: ${args.url}`,
    "HTML:",
    html,
  ]
    .filter(Boolean)
    .join("\n\n");

  const result = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }],
      },
    ],
  });

  const text = result.response?.text();
  if (!text) {
    throw new Error("Gemini não retornou conteúdo");
  }

  const parsed = extractJsonCandidate(text);
  return ensureScrapedProduct(parsed, args);
}
