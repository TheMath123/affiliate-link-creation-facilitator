"use server";
import { env } from "@/env";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, isValidSessionToken } from "@/lib/auth/session";

export async function scrapeProduct(url: string) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!isValidSessionToken(sessionToken)) {
    return {
      success: false,
      error: "Sessão expirada. Faça login novamente.",
    };
  }

  const response = await fetch(env.APP_URL + "/api/scrape", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `${SESSION_COOKIE_NAME}=${sessionToken}`,
    },
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
