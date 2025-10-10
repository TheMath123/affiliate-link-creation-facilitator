import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    APP_URL: z.string().min(1),
    GEMINI_API_KEY: z.string().min(1),
  },
  client: {
    NEXT_PUBLIC_BETTER_STACK_SOURCE_TOKEN: z.string().min(1),
    NEXT_PUBLIC_BETTER_STACK_INGESTING_URL: z.string().min(1),
  },
  runtimeEnv: {
    APP_URL: process.env.APP_URL,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    NEXT_PUBLIC_BETTER_STACK_SOURCE_TOKEN:
      process.env.NEXT_PUBLIC_BETTER_STACK_SOURCE_TOKEN,
    NEXT_PUBLIC_BETTER_STACK_INGESTING_URL:
      process.env.NEXT_PUBLIC_BETTER_STACK_INGESTING_URL,
  },
});
