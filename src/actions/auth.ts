"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ResponseCookies } from "next/dist/compiled/@edge-runtime/cookies";
import { env } from "@/env";
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  createSessionToken,
  isValidSessionToken,
} from "@/lib/auth/session";

export type LoginActionState = {
  error?: string;
};

export async function loginAction(
  _prevState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const username = (formData.get("username") ?? "").toString().trim();
  const password = (formData.get("password") ?? "").toString();

  if (username !== env.ADMIN_USERNAME || password !== env.ADMIN_PASSWORD) {
    return { error: "Credenciais inválidas" };
  }

  const cookieStore = (await cookies()) as ResponseCookies;
  cookieStore.set({
    name: SESSION_COOKIE_NAME,
    value: createSessionToken(),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  redirect("/");
}

export async function logoutAction() {
  const cookieStore = (await cookies()) as ResponseCookies;
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (token && !isValidSessionToken(token)) {
    // Invalida cookies forçados
    cookieStore.delete(SESSION_COOKIE_NAME);
  }
  cookieStore.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    maxAge: 0,
    path: "/",
  });
  redirect("/login");
}
