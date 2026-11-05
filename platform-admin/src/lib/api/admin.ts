"use client";

/**
 * Typed platform admin API surface.
 *
 * One function per endpoint, each returning the payload type from `types.ts`.
 * Screens never build URLs or touch the response envelope: they call these and
 * catch `ApiRequestError`.
 *
 * Every endpoint here crosses the tenant boundary by design - this panel sees
 * all companies - which is exactly why it is a separate application behind a
 * separate login from anything a customer can reach.
 */

import { request, requestPaged, type Paged } from "./client";
import type {
  AdminCompanyRow,
  AdminKeyRow,
  AdminDeliveryRow,
  AdminUserRow,
  ClearPreview,
  ClearRequested,
  AuditEntry,
  Company,
  CompanyStatus,
  Delivery,
  DeliveryDetail,
  Device,
  CompanySummary,
  Member,
  PlatformAdmin,
  SystemOverview,
  PlatformTrend,
  SdkConfig,
} from "./types";

type Auth = { token: string };

export type ListQuery = {
  page?: number;
  page_size?: number;
  q?: string;
  status?: string | null;
};

/**
 * Admin reads are never cached.
 *
 * This panel exists to answer "what is happening right now" - queue depth,
 * active devices, whether a suspension took effect. A cached answer to any of
 * those is worse than a slow one.
 */
const FRESH = { cache: "no-store" as const };

/**
 * Reads take an optional abort signal.
 *
 * `useAsync` aborts a superseded request, but only if the signal reaches the
 * fetch. Without it the request ran to completion for an answer nobody would
 * read - one wasted query per keystroke on a search box.
 */
type Signal = AbortSignal | undefined;

/* ---------- me ---------- */

export const meApi = {
  /**
   * Who the caller is, as this service understands them.
   *
   * The Supabase token proves the identity; this confirms it is staff. A row
   * removed from `platform_admins` revokes access on the very next request,
   * which is why this is asked rather than read off the token.
   */
  get: ({ token }: Auth): Promise<PlatformAdmin> =>
    request<PlatformAdmin>("/admin/me", { token, ...FRESH }),
};

/* ---------- system ---------- */

export const overviewApi = {
  get: ({ token }: Auth): Promise<SystemOverview> =>
    request<SystemOverview>("/admin/overview", { token, ...FRESH }),

  /** One row per day across the whole platform, empty days included. */
  trend: ({ token }: Auth, days = 30, signal?: AbortSignal): Promise<PlatformTrend[]> =>
    request<PlatformTrend[]>(`/admin/trend?days=${days}`, {
      token,
      signal,
      ...FRESH,
    }),
};

/* ---------- companies ---------- */

export const companiesApi = {
  list: (
    { token }: Auth,
    query: ListQuery = {},
    signal?: Signal,
  ): Promise<Paged<AdminCompanyRow>> =>
    requestPaged<AdminCompanyRow>("/admin/companies", {
      token,
      query,
      signal,
      ...FRESH,
    }),

  get: ({ token }: Auth, id: string): Promise<Company> =>
    request<Company>(`/admin/companies/${id}`, { token, ...FRESH }),

  /** Everything the company page shows above the fold, in one request. */
  summary: (
    { token }: Auth,
    id: string,
    signal?: Signal,
  ): Promise<CompanySummary> =>
    request<CompanySummary>(`/admin/companies/${id}/summary`, {
      token,
      signal,
      ...FRESH,
    }),

  members: ({ token }: Auth, id: string): Promise<Member[]> =>
    request<Member[]>(`/admin/companies/${id}/members`, { token, ...FRESH }),

  devices: (
    { token }: Auth,
    id: string,
    query: ListQuery = {},
  ): Promise<Paged<Device>> =>
    requestPaged<Device>(`/admin/companies/${id}/devices`, {
      token,
      query,
      ...FRESH,
    }),

  deliveries: (
    { token }: Auth,
    id: string,
    query: ListQuery = {},
  ): Promise<Paged<Delivery>> =>
    requestPaged<Delivery>(`/admin/companies/${id}/deliveries`, {
      token,
      query,
      ...FRESH,
    }),

  /**
   * One delivery, in full.
   *
   * Not under `/companies/{id}` like the list it is opened from: the id is a
   * uuid and this panel is staff-only, so requiring the company as well would
   * mean a mismatched pair answered 404 for a delivery that plainly exists.
   */
  delivery: ({ token }: Auth, deliveryId: string, signal?: Signal):
    Promise<DeliveryDetail> =>
    request<DeliveryDetail>(`/admin/deliveries/${deliveryId}`, {
      token,
      signal,
      ...FRESH,
    }),

  /**
   * Suspending is immediate and total: the dashboard, every API key and every
   * live device token stop working on the next request. The screen that calls
   * this should say so before it is pressed.
   */
  setStatus: (
    { token }: Auth,
    id: string,
    status: CompanyStatus,
    rateLimitPerMinute?: number | null,
  ): Promise<Company> =>
    request<Company>(`/admin/companies/${id}/status`, {
      method: "PATCH",
      token,
      body: {
        status,
        ...(rateLimitPerMinute === undefined
          ? {}
          : { rate_limit_per_minute: rateLimitPerMinute }),
      },
    }),
};


/* ---------- platform-wide ---------- */

/**
 * The three §23 screens that could only be reached one company at a time.
 *
 * "Which companies have live credentials" and "who did that" are not questions
 * you answer by opening thirty company pages.
 */
export const platformApi = {
  users: (
    { token }: Auth,
    query: ListQuery = {},
    signal?: Signal,
  ): Promise<Paged<AdminUserRow>> =>
    requestPaged<AdminUserRow>("/admin/users", { token, query, signal, ...FRESH }),

  /**
   * What erasing the operational data would remove, counted now.
   *
   * Read before the button is shown, so it can say what it does rather than
   * the word "everything".
   */
  clearPreview: ({ token }: Auth, signal?: Signal): Promise<ClearPreview> =>
    request<ClearPreview>("/admin/data/clear", { token, signal, ...FRESH }),

  /** Step one. Deletes nothing; emails a single-use confirmation link. */
  requestClear: ({ token }: Auth): Promise<ClearRequested> =>
    request<ClearRequested>("/admin/data/clear", { method: "POST", token }),

  /** Step two. The token comes from the emailed link. This one deletes. */
  confirmClear: (
    { token }: Auth,
    confirmation: string,
  ): Promise<{ removed: Record<string, number> }> =>
    request<{ removed: Record<string, number> }>("/admin/data/clear/confirm", {
      method: "POST",
      token,
      body: { token: confirmation },
    }),

  /**
   * Deliveries across every company.
   *
   * `on` is a single UTC day, which is what the overview links to; `from` and
   * `to` take a range instead.
   */
  deliveries: (
    { token }: Auth,
    query: ListQuery & {
      on?: string;
      from?: string;
      to?: string;
      status?: string;
      company_id?: string;
    } = {},
    signal?: Signal,
  ): Promise<Paged<AdminDeliveryRow>> =>
    requestPaged<AdminDeliveryRow>("/admin/deliveries", {
      token,
      query,
      signal,
      ...FRESH,
    }),

  keys: (
    { token }: Auth,
    query: ListQuery = {},
    signal?: Signal,
  ): Promise<Paged<AdminKeyRow>> =>
    requestPaged<AdminKeyRow>("/admin/api-keys", { token, query, signal, ...FRESH }),

  audit: (
    { token }: Auth,
    query: ListQuery & {
      action?: string;
      company_id?: string;
      /** The part of an action before the dot: api_key, member, access. */
      category?: string;
      /** "success" or "failure". The refusals are the ones worth reading. */
      outcome?: string;
    } = {},
    signal?: Signal,
  ): Promise<Paged<AuditEntry>> =>
    requestPaged<AuditEntry>("/admin/audit", { token, query, signal, ...FRESH }),
};

/* ---------- what handsets collect ---------- */

/**
 * The remote configuration, at both levels.
 *
 * Two levels rather than one because a company stores only what it differs
 * on: raising a platform default then lifts every company that has not
 * overridden that particular setting, which is the entire reason a default
 * exists. Writes send the overrides for one level, never the merged
 * document - saving the effective configuration as an override would pin
 * that company to today's defaults forever.
 */
export const configApi = {
  platform: ({ token }: Auth, signal?: Signal): Promise<SdkConfig> =>
    request<SdkConfig>("/admin/config", { token, signal, ...FRESH }),

  setPlatform: ({ token }: Auth, config: Record<string, unknown>): Promise<SdkConfig> =>
    request<SdkConfig>("/admin/config", { method: "PUT", token, body: { config } }),

};

/* ---------- platform staff ---------- */

export const staffApi = {
  list: ({ token }: Auth, signal?: Signal): Promise<PlatformAdmin[]> =>
    request<PlatformAdmin[]>("/admin/staff", { token, signal, ...FRESH }),

  /**
   * Invite another administrator.
   *
   * This grants sight of every company on the platform, which is why it is a
   * separate action from inviting somebody into a company rather than a role
   * on the same call.
   */
  invite: (
    { token }: Auth,
    body: { email: string; name: string },
  ): Promise<{ staff: PlatformAdmin; email_sent: boolean }> =>
    request("/admin/staff", { method: "POST", token, body }),

  revoke: ({ token }: Auth, id: string): Promise<unknown> =>
    request(`/admin/staff/${id}`, { method: "DELETE", token }),
};
