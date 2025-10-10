import { createHash, timingSafeEqual } from "crypto";
import { env } from "@/env";

export const SESSION_COOKIE_NAME = "affiliate_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12; // 12 horas

function expectedSessionToken() {
  return createHash("sha256")
    .update(
      `${env.ADMIN_USERNAME}:${env.ADMIN_PASSWORD}:${env.AUTH_SECRET}`,
      "utf8",
    )
    .digest("hex");
}

export function createSessionToken() {
  return expectedSessionToken();
}

export function isValidSessionToken(token?: string | null) {
  if (!token) return false;
  try {
    const expected = expectedSessionToken();
    const tokenBuffer = Buffer.from(token, "utf8");
    const expectedBuffer = Buffer.from(expected, "utf8");
    if (tokenBuffer.length !== expectedBuffer.length) {
      return false;
    }
    return timingSafeEqual(tokenBuffer, expectedBuffer);
  } catch {
    return false;
  }
}
