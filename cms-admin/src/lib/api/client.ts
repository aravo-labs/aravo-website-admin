/**
 * The single way this app talks to the API.
 *
 * Everything goes through `request()`, which unwraps the standard envelope and
 * throws `ApiRequestError` on failure. Callers therefore work with the payload
 * type directly and handle problems with try/catch, instead of every component
 * re-checking `success` and reaching into `data` that might be null.
 */

import type {
  ApiResponse,
  ErrorCode,
  ErrorDetail,
  PaginationMeta,
} from "./types";

const BASE_URL = (
  // 8010 is where the API actually runs; 8000 was a default that only
  // applied when NEXT_PUBLIC_API_URL was missing, which is exactly when a
  // fallback has to be right.
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8010"
).replace(/\/$/, "");

const PREFIX = "/api/v1";

/**
 * A failed API call.
 *
 * `code` is the stable machine-readable code to branch on. `requestId` is the
 * correlation id from `meta` and the `X-Request-ID` header, which is the one
 * string worth putting in a bug report.
 */
export class ApiRequestError extends Error {
  readonly code: ErrorCode | string;
  readonly status: number;
  readonly details: ErrorDetail[];
  readonly requestId: string | null;

  constructor(init: {
    code: string;
    message: string;
    status: number;
    details?: ErrorDetail[] | null;
    requestId?: string | null;
  }) {
    super(init.message);
    this.name = "ApiRequestError";
    this.code = init.code;
    this.status = init.status;
    this.details = init.details ?? [];
    this.requestId = init.requestId ?? null;
  }

  /** Field-level messages, keyed by field, for rendering next to inputs. */
  get fieldErrors(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const d of this.details) {
      if (d.field && !out[d.field]) out[d.field] = d.message;
    }
    return out;
  }

  /**
   * Messages that belong to the whole request rather than one input.
   *
   * Cross-field rules (a banner variant that requires items, a CTA label that
   * requires a URL) arrive with no field path. Without this they would be
   * silently dropped and the user would see only "the request failed
   * validation", which tells them nothing about what to change.
   */
  get formErrors(): string[] {
    return this.details.filter((d) => !d.field).map((d) => d.message);
  }

  /** The most useful sentence available for showing at the top of a form. */
  get summary(): string {
    return this.formErrors[0] ?? this.message;
  }

  /**
   * What to print at the top of a form, or null if the inputs say it already.
   *
   * Forms used to decide this themselves with "show the message unless there
   * are field errors", and that rule is wrong whenever the field named by the
   * error is not one the form renders. Creating a second published banner
   * returned a 409 whose only detail pointed at `status`, the one field in
   * that editor with no error slot - so the save failed, the modal stayed
   * open, and nothing at all appeared. Silence is the worst possible report.
   *
   * Only a validation failure is allowed to stay quiet, and only when it has
   * field errors to speak for it. Everything else - a conflict, a permission,
   * a server fault - gets a sentence.
   */
  get formMessage(): string | null {
    if (this.formErrors.length) return this.formErrors[0];
    if (this.code !== "VALIDATION_ERROR") return this.message;

    // A field error only speaks for itself if a form can put it beside an
    // input, and only top-level names get that far: nothing renders a key
    // like `items.0.label`, so a nested path left alone is a save that fails
    // in silence. Those are named here instead, in the terms the form uses.
    if (Object.keys(this.fieldErrors).some((key) => !key.includes("."))) return null;

    const nested = Object.entries(this.fieldErrors).map(
      ([path, message]) => `${describeFieldPath(path)}: ${message}`,
    );
    return nested.length ? nested.join(". ") : this.message;
  }

  get isAuth(): boolean {
    return this.code === "UNAUTHENTICATED" || this.code === "FORBIDDEN";
  }

  /** Worth offering a retry for; a validation failure is not. */
  get isRetryable(): boolean {
    return (
      this.code === "SERVICE_UNAVAILABLE" ||
      this.code === "RATE_LIMITED" ||
      this.status >= 500
    );
  }
}

/**
 * `items.0.label` as something a person can act on: "Item 1, label".
 *
 * The API names fields the way the payload is shaped, which is correct and
 * unreadable. Index segments are turned into ordinals, and the rest is left as
 * written - inventing labels for every field of every payload would be a
 * second vocabulary to keep in step with the first.
 */
function describeFieldPath(path: string): string {
  return path
    .split(".")
    .map((part, i, all) =>
      /^\d+$/.test(part)
        ? `${all[i - 1] ? all[i - 1].replace(/s$/, "") : "item"} ${Number(part) + 1}`
        : part,
    )
    .filter((part, i, all) => !(all[i + 1] ?? "").startsWith(part.replace(/s$/, "") + " "))
    .join(", ");
}

/** A list response plus its pagination metadata. */
export type Paged<T> = {
  items: T[];
  pagination: PaginationMeta | null;
};

export type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  /** Supabase access token, for admin endpoints. */
  token?: string | null;
  query?: Record<string, string | number | boolean | null | undefined>;
  signal?: AbortSignal;
  /** Bypass the fetch cache. Admin reads should always be fresh. */
  cache?: RequestCache;
  /** Next.js revalidation window for public reads, in seconds. */
  revalidate?: number;
};

function buildUrl(
  path: string,
  query?: RequestOptions["query"]
): string {
  const url = new URL(`${BASE_URL}${PREFIX}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== null && value !== undefined && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

/**
 * Perform a request and return the unwrapped `data`.
 *
 * Throws `ApiRequestError` for any non-2xx response, and also for a 2xx whose
 * envelope reports failure - the two should never disagree, but trusting the
 * status code alone would make that disagreement silent.
 */
/**
 * Perform a request and return the unwrapped envelope.
 *
 * Every call goes through here, so the failure handling is written once.
 * `requestPaged` used to be a near-copy that omitted the try/catch around
 * `fetch` and `.json()`, which meant every list screen in the app - the most
 * used path there is - lost the real error and reported "something went wrong"
 * for an offline connection or a gateway page.
 */
async function perform<T>(
  path: string,
  options: RequestOptions = {}
): Promise<{ data: T | null; pagination: PaginationMeta | null }> {
  const {
    method = "GET",
    body,
    token,
    query,
    signal,
    cache,
    revalidate,
  } = options;

  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;

  const headers: Record<string, string> = {};
  if (!isFormData && body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: isFormData
        ? (body as FormData)
        : body !== undefined
          ? JSON.stringify(body)
          : undefined,
      signal,
      cache,
      ...(revalidate !== undefined ? { next: { revalidate } } : {}),
    });
  } catch (cause) {
    // The request never reached the API: DNS, offline, CORS preflight, abort.
    if (cause instanceof DOMException && cause.name === "AbortError") throw cause;
    throw new ApiRequestError({
      code: "SERVICE_UNAVAILABLE",
      message: "Could not reach the server. Check your connection and retry.",
      status: 0,
    });
  }

  const requestId = response.headers.get("X-Request-ID");

  let envelope: ApiResponse<T> | null = null;
  try {
    envelope = (await response.json()) as ApiResponse<T>;
  } catch {
    // A response outside the envelope means something upstream of the app
    // answered - a proxy or gateway, typically.
    throw new ApiRequestError({
      code: response.ok ? "INTERNAL_ERROR" : "SERVICE_UNAVAILABLE",
      message: "The server returned an unreadable response.",
      status: response.status,
      requestId,
    });
  }

  if (!response.ok || !envelope.success) {
    throw new ApiRequestError({
      code: envelope.error?.code ?? "INTERNAL_ERROR",
      message: envelope.error?.message ?? "Something went wrong.",
      status: response.status,
      details: envelope.error?.details,
      requestId: envelope.meta?.request_id ?? requestId,
    });
  }

  return { data: envelope.data ?? null, pagination: envelope.meta?.pagination ?? null };
}

/**
 * Perform a request and return the unwrapped `data`.
 *
 * Throws `ApiRequestError` for any non-2xx response, and also for a 2xx whose
 * envelope reports failure - the two should never disagree, but trusting the
 * status code alone would make that disagreement silent.
 */
export async function request<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { data } = await perform<T>(path, options);
  return data as T;
}

/**
 * Like `request`, but keeps `meta.pagination` instead of discarding it.
 * Use for any list endpoint whose total or page count is shown.
 */
export async function requestPaged<T>(
  path: string,
  options: RequestOptions = {}
): Promise<Paged<T>> {
  const { data, pagination } = await perform<T[]>(path, options);
  return { items: data ?? [], pagination };
}
