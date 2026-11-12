import type { z } from "zod";

/** Thrown anywhere inside `handle` to end the request with `{ error }` and this status. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

export function errorJson(status: number, message: string, headers: Record<string, string> = {}) {
  return json({ error: message }, status, headers);
}

export function documentUrl(req: Request, id: string) {
  return `${new URL(req.url).origin}/d/${id}`;
}

export async function handle(fn: () => Promise<Response>) {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof ApiError) return errorJson(error.status, error.message);
    console.error(error);
    return errorJson(500, "internal error");
  }
}

export async function readJsonObject(req: Request): Promise<Record<string, unknown>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new ApiError(400, "body must be valid JSON");
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new ApiError(400, "body must be a JSON object");
  }
  return body as Record<string, unknown>;
}

/**
 * Validates `data` against `schema`. Issues raised with `params: { status: 413 }`
 * (oversized html) turn into 413, everything else into 400 naming the first issue.
 */
export function parse<T extends z.ZodType>(schema: T, data: unknown): z.output<T> {
  const result = schema.safeParse(data);
  if (result.success) return result.data;
  const issues = result.error.issues;
  const tooLarge = issues.find((issue) => issue.code === "custom" && issue.params?.status === 413);
  const issue = tooLarge ?? issues[0];
  const path = issue.path.map(String).join(".");
  throw new ApiError(tooLarge ? 413 : 400, path ? `${path}: ${issue.message}` : issue.message);
}
