const BASE36 = "0123456789abcdefghijklmnopqrstuvwxyz";
const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

// Rejection sampling keeps every character uniformly random.
function randomString(length: number, alphabet: string) {
  const limit = 256 - (256 % alphabet.length);
  let out = "";
  while (out.length < length) {
    for (const byte of crypto.getRandomValues(new Uint8Array(length * 2))) {
      if (byte < limit && out.length < length) out += alphabet[byte % alphabet.length];
    }
  }
  return out;
}

export function slugify(text: string, max = 48) {
  const slug = text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/g, "");
  return slug || "doc";
}

/** Readable but unguessable public id: `<title-slug>-<14 base36 chars>` (about 72 bits). */
export function newDocumentId(title: string) {
  return `${slugify(title)}-${randomString(14, BASE36)}`;
}

export function newId() {
  return crypto.randomUUID();
}

/** API token shown once to the user. Only its SHA-256 is stored. */
export function newApiToken() {
  return `rpt_${randomString(40, BASE62)}`;
}

/** Session cookie value. Only its SHA-256 is stored. */
export function newSessionToken() {
  return randomString(48, BASE62);
}

export async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
