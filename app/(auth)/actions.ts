"use server";

import { redirect } from "next/navigation";
import { checkCredentials, createUser, MIN_PASSWORD_LENGTH, startSession } from "@/lib/auth";

export type AuthState = { error?: string; email?: string };

// Caps PBKDF2 work per request; nobody needs a longer password.
const MAX_PASSWORD_LENGTH = 256;

function readForm(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  return { email, password };
}

export async function login(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const { email, password } = readForm(formData);
  const user = password.length <= MAX_PASSWORD_LENGTH ? await checkCredentials(email, password) : null;
  if (!user) return { error: "Wrong email or password.", email };
  await startSession(user.id);
  redirect("/docs");
}

export async function register(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const { email, password } = readForm(formData);
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Enter a valid email.", email };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`, email };
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return { error: `Password must be at most ${MAX_PASSWORD_LENGTH} characters.`, email };
  }
  const user = await createUser(email, password);
  if (!user) return { error: "That email is already registered. Log in instead.", email };
  await startSession(user.id);
  redirect("/docs");
}
