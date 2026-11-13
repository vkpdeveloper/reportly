"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { endSession, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { newApiToken, newId, sha256Hex } from "@/lib/ids";
import { deleteDocumentWithMedia } from "@/lib/media";

export async function logout() {
  await endSession();
  redirect("/login");
}

// Every mutation scopes by user_id so a forged id can only ever touch the caller's rows.

export async function deleteDocument(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  await deleteDocumentWithMedia(id, user.id);
  refresh();
}

export async function revokeToken(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  await db().prepare("DELETE FROM api_tokens WHERE id = ? AND user_id = ?").bind(id, user.id).run();
  refresh();
}

export type CreateTokenState = { error?: string; token?: string; origin?: string };

export async function createToken(_prev: CreateTokenState, formData: FormData): Promise<CreateTokenState> {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Give the token a name." };
  if (name.length > 64) return { error: "Keep the name under 64 characters." };

  const token = newApiToken();
  await db()
    .prepare("INSERT INTO api_tokens (id, user_id, name, token_hash, last4, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(newId(), user.id, name, await sha256Hex(token), token.slice(-4), Date.now())
    .run();
  refresh();

  // Browsers always send Origin on server action POSTs; it is the URL the user's agents should call.
  const h = await headers();
  const origin = h.get("origin") ?? `https://${h.get("host")}`;
  return { token, origin };
}
