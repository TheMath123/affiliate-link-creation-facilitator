"use server";
import { env } from "@/env";

export async function scrapeProduct(url: string) {
  const response = await fetch(env.APP_URL + "/api/scrape", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });

  const data = await response.json();
  if (!response.ok) {
    return {
      success: false,
      error: data.error || "Erro ao fazer scraping",
    };
  }
  return { success: true, data };
}
