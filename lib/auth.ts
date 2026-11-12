import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "./db";
import { newId, newSessionToken, sha256Hex } from "./ids";

// 100000 is the highest PBKDF2 iteration count Cloudflare Workers allows.
const ITERATIONS = 100_000;
const SESSION_COOKIE = "rp_session";
const SESSION_DAYS = 30;
export const MIN_PASSWORD_LENGTH = 8;

export type User = { id: string; email: string };

function toBase64(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes));
}

function fromBase64(text: string) {
  return Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
}

async function pbkdf2(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256);
  return new Uint8Array(bits);
}

/** Returns `pbkdf2$<iterations>$<salt b64>$<hash b64>`. */
export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, ITERATIONS);
  return `pbkdf2$${ITERATIONS}$${toBase64(salt)}$${toBase64(hash)}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [scheme, iterations, salt, hash] = stored.split("$");
  if (scheme !== "pbkdf2" || !iterations || !salt || !hash) return false;
  const expected = fromBase64(hash);
  const actual = await pbkdf2(password, fromBase64(salt), Number(iterations));
  if (actual.length !== expected.length) return false;
  // Constant-time: always walk every byte.
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

// Verified against when the email is unknown, so failed logins take the same time either way.
const DUMMY_HASH = "pbkdf2$100000$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";

/** Returns the user only when the email exists and the password matches. */
export async function checkCredentials(email: string, password: string): Promise<User | null> {
  const row = await db()
    .prepare("SELECT id, email, password_hash FROM users WHERE email = ?")
    .bind(normalizeEmail(email))
    .first<User & { password_hash: string }>();
  const ok = await verifyPassword(password, row?.password_hash ?? DUMMY_HASH);
  return row && ok ? { id: row.id, email: row.email } : null;
}

/** Creates the user, or returns null when the email is already registered. */
export async function createUser(email: string, password: string): Promise<User | null> {
  const user = { id: newId(), email: normalizeEmail(email) };
  const result = await db()
    .prepare("INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING")
    .bind(user.id, user.email, await hashPassword(password), Date.now())
    .run();
  return result.meta.changes > 0 ? user : null;
}

/** Starts a session and sets the cookie. Only callable from server actions or route handlers. */
export async function startSession(userId: string) {
  const token = newSessionToken();
  const now = Date.now();
  const expiresAt = now + SESSION_DAYS * 24 * 60 * 60 * 1000;
  await db().batch([
    db().prepare("DELETE FROM sessions WHERE user_id = ? AND expires_at <= ?").bind(userId, now),
    db()
      .prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)")
      .bind(await sha256Hex(token), userId, expiresAt),
  ]);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    expires: new Date(expiresAt),
  });
}

/** Deletes the session row and clears the cookie. Only callable from server actions or route handlers. */
export async function endSession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await db().prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sha256Hex(token)).run();
  }
  store.delete(SESSION_COOKIE);
}

export const getCurrentUser = cache(async (): Promise<User | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return db()
    .prepare(
      "SELECT users.id, users.email FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.token_hash = ? AND sessions.expires_at > ?",
    )
    .bind(await sha256Hex(token), Date.now())
    .first<User>();
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
