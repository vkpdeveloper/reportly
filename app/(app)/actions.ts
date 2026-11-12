"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { endSession, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function logout() {
  await endSession();
  redirect("/login");
}

// Every mutation scopes by user_id so a forged id can only ever touch the caller's rows.

export async function deleteDocument(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  // sections and blocks go with it through ON DELETE CASCADE.
  await db().prepare("DELETE FROM documents WHERE id = ? AND user_id = ?").bind(id, user.id).run();
  refresh();
}

export async function revokeToken(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  await db().prepare("DELETE FROM api_tokens WHERE id = ? AND user_id = ?").bind(id, user.id).run();
  refresh();
}
