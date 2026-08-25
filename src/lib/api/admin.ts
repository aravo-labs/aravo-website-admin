"use client";

/**
 * Typed admin API surface.
 *
 * One function per endpoint, each returning the payload type from
 * `types.ts`. Screens never build URLs or touch the envelope; they call these
 * and catch `ApiRequestError`.
 */

import { request, requestPaged, type Paged } from "./client";
import type {
  Application,
  ApplicationStatus,
  ApplicationUpdate,
  Banner,
  BannerCreate,
  BannerUpdate,
  ContentStatus,
  DocPage,
  DocPageCreate,
  DocPageUpdate,
  Faq,
  FaqCreate,
  FaqUpdate,
  Job,
  JobCreate,
  JobUpdate,
  Page,
  PageCreate,
  PageUpdate,
  Platform,
  PlatformCreate,
  PlatformUpdate,
  RequestStatus,
  ResumeLink,
  SdkRequest,
  SdkRequestUpdate,
  SiteSettings,
  SiteSettingsUpdate,
  SmtpSettings,
  SmtpSettingsUpdate,
  TeamMember,
  TeamMemberCreate,
  TeamMemberUpdate,
  UploadedImage,
} from "./types";

type Auth = { token: string };

export type ListQuery = {
  page?: number;
  page_size?: number;
  q?: string;
  status?: string | null;
};

/** Admin reads are never cached: stale content in a CMS is a bug report. */
const FRESH = { cache: "no-store" as const };

/* ---------- jobs ---------- */

export const jobsApi = {
  list: ({ token }: Auth, query: ListQuery = {}): Promise<Paged<Job>> =>
    requestPaged<Job>("/admin/jobs", { token, query, ...FRESH }),

  get: ({ token }: Auth, id: string): Promise<Job> =>
    request<Job>(`/admin/jobs/${id}`, { token, ...FRESH }),

  create: ({ token }: Auth, body: JobCreate): Promise<Job> =>
    request<Job>("/admin/jobs", { method: "POST", token, body }),

  update: ({ token }: Auth, id: string, body: JobUpdate): Promise<Job> =>
    request<Job>(`/admin/jobs/${id}`, { method: "PATCH", token, body }),

  remove: ({ token }: Auth, id: string): Promise<unknown> =>
    request(`/admin/jobs/${id}`, { method: "DELETE", token }),

  setStatus: (
    { token }: Auth,
    id: string,
    status: ContentStatus,
  ): Promise<Job> =>
    request<Job>(`/admin/jobs/${id}`, {
      method: "PATCH",
      token,
      body: { status },
    }),
};

/* ---------- applications ---------- */

export const applicationsApi = {
  list: ({ token }: Auth, query: ListQuery = {}): Promise<Paged<Application>> =>
    requestPaged<Application>("/admin/applications", {
      token,
      query,
      ...FRESH,
    }),

  get: ({ token }: Auth, id: string): Promise<Application> =>
    request<Application>(`/admin/applications/${id}`, { token, ...FRESH }),

  update: (
    { token }: Auth,
    id: string,
    body: ApplicationUpdate,
  ): Promise<Application> =>
    request<Application>(`/admin/applications/${id}`, {
      method: "PATCH",
      token,
      body,
    }),

  setStatus: (
    auth: Auth,
    id: string,
    status: ApplicationStatus,
  ): Promise<Application> => applicationsApi.update(auth, id, { status }),

  /** Short-lived signed URL; do not store the result. */
  resumeLink: ({ token }: Auth, id: string): Promise<ResumeLink> =>
    request<ResumeLink>(`/admin/applications/${id}/resume`, {
      token,
      ...FRESH,
    }),

  remove: ({ token }: Auth, id: string): Promise<unknown> =>
    request(`/admin/applications/${id}`, { method: "DELETE", token }),
};

/* ---------- SDK requests ---------- */

export const sdkRequestsApi = {
  list: ({ token }: Auth, query: ListQuery = {}): Promise<Paged<SdkRequest>> =>
    requestPaged<SdkRequest>("/admin/sdk-requests", { token, query, ...FRESH }),

  update: (
    { token }: Auth,
    id: string,
    body: SdkRequestUpdate,
  ): Promise<SdkRequest> =>
    request<SdkRequest>(`/admin/sdk-requests/${id}`, {
      method: "PATCH",
      token,
      body,
    }),

  setStatus: (
    auth: Auth,
    id: string,
    status: RequestStatus,
  ): Promise<SdkRequest> => sdkRequestsApi.update(auth, id, { status }),

  remove: ({ token }: Auth, id: string): Promise<unknown> =>
    request(`/admin/sdk-requests/${id}`, { method: "DELETE", token }),
};

/* ---------- SDK documentation ---------- */

export const docsApi = {
  list: ({ token }: Auth, query: ListQuery = {}): Promise<Paged<DocPage>> =>
    requestPaged<DocPage>("/admin/docs", { token, query, ...FRESH }),

  get: ({ token }: Auth, id: string): Promise<DocPage> =>
    request<DocPage>(`/admin/docs/${id}`, { token, ...FRESH }),

  create: ({ token }: Auth, body: DocPageCreate): Promise<DocPage> =>
    request<DocPage>("/admin/docs", { method: "POST", token, body }),

  update: (
    { token }: Auth,
    id: string,
    body: DocPageUpdate,
  ): Promise<DocPage> =>
    request<DocPage>(`/admin/docs/${id}`, { method: "PATCH", token, body }),

  remove: ({ token }: Auth, id: string): Promise<unknown> =>
    request(`/admin/docs/${id}`, { method: "DELETE", token }),
};

/* ---------- team ---------- */

export const teamApi = {
  list: ({ token }: Auth, query: ListQuery = {}): Promise<Paged<TeamMember>> =>
    requestPaged<TeamMember>("/admin/team", { token, query, ...FRESH }),

  create: ({ token }: Auth, body: TeamMemberCreate): Promise<TeamMember> =>
    request<TeamMember>("/admin/team", { method: "POST", token, body }),

  update: (
    { token }: Auth,
    id: string,
    body: TeamMemberUpdate,
  ): Promise<TeamMember> =>
    request<TeamMember>(`/admin/team/${id}`, { method: "PATCH", token, body }),

  remove: ({ token }: Auth, id: string): Promise<unknown> =>
    request(`/admin/team/${id}`, { method: "DELETE", token }),
};

/* ---------- banners ---------- */

export const bannersApi = {
  list: ({ token }: Auth, query: ListQuery = {}): Promise<Paged<Banner>> =>
    requestPaged<Banner>("/admin/banners", { token, query, ...FRESH }),

  create: ({ token }: Auth, body: BannerCreate): Promise<Banner> =>
    request<Banner>("/admin/banners", { method: "POST", token, body }),

  update: ({ token }: Auth, id: string, body: BannerUpdate): Promise<Banner> =>
    request<Banner>(`/admin/banners/${id}`, { method: "PATCH", token, body }),

  /** Promotes this banner and archives whichever was live, server-side. */
  publish: ({ token }: Auth, id: string): Promise<Banner> =>
    request<Banner>(`/admin/banners/${id}/publish`, { method: "POST", token }),

  remove: ({ token }: Auth, id: string): Promise<unknown> =>
    request(`/admin/banners/${id}`, { method: "DELETE", token }),
};

/* ---------- membership and your own account ---------- */

export type Member = {
  id: string;
  email: string;
  name: string;
  role: "editor" | "admin" | "owner";
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CurrentAdmin = {
  id: string;
  email: string | null;
  name: string;
  role: "editor" | "admin" | "owner";
};

export const membersApi = {
  me: ({ token }: Auth): Promise<CurrentAdmin> =>
    request<CurrentAdmin>("/admin/me", { token, ...FRESH }),

  list: ({ token }: Auth, query: ListQuery = {}): Promise<Paged<Member>> =>
    requestPaged<Member>("/admin/members", { token, query, ...FRESH }),

  invite: (
    { token }: Auth,
    body: { email: string; name: string; role: Member["role"] },
  ): Promise<Member> =>
    request<Member>("/admin/members", { method: "POST", token, body }),

  update: (
    { token }: Auth,
    id: string,
    body: { name?: string; role?: Member["role"]; is_active?: boolean },
  ): Promise<Member> =>
    request<Member>(`/admin/members/${id}`, { method: "PATCH", token, body }),

  remove: ({ token }: Auth, id: string): Promise<unknown> =>
    request(`/admin/members/${id}`, { method: "DELETE", token }),

  changePassword: (
    { token }: Auth,
    body: { current_password: string; new_password: string },
  ): Promise<unknown> =>
    request("/admin/me/password", { method: "POST", token, body }),
};

/**
 * The mail server invitations and password resets are sent through.
 *
 * `get` never returns the stored password - `has_password` says whether one
 * exists, and `reveal` is the only way to see it, which costs your own account
 * password.
 */
export const smtpApi = {
  get: ({ token }: Auth): Promise<SmtpSettings | null> =>
    request<SmtpSettings | null>("/admin/settings/smtp", {
      token,
      cache: "no-store",
    }),

  save: ({ token }: Auth, body: SmtpSettingsUpdate): Promise<SmtpSettings> =>
    request<SmtpSettings>("/admin/settings/smtp", {
      method: "PUT",
      token,
      body,
    }),

  reveal: (
    { token }: Auth,
    accountPassword: string,
  ): Promise<{ password: string }> =>
    request<{ password: string }>("/admin/settings/smtp/reveal", {
      method: "POST",
      token,
      body: { account_password: accountPassword },
    }),

  test: (
    { token }: Auth,
    to?: string,
  ): Promise<{ sent_to: string; message: string }> =>
    request<{ sent_to: string; message: string }>("/admin/settings/smtp/test", {
      method: "POST",
      token,
      body: { to: to || null },
    }),

  setActive: ({ token }: Auth, isActive: boolean): Promise<SmtpSettings> =>
    request<SmtpSettings>("/admin/settings/smtp/activation", {
      method: "POST",
      token,
      body: { is_active: isActive },
    }),
};

/* ---------- platforms ---------- */

export const platformsApi = {
  list: ({ token }: Auth, query: ListQuery = {}): Promise<Paged<Platform>> =>
    requestPaged<Platform>("/admin/platforms", { token, query, ...FRESH }),

  create: ({ token }: Auth, body: PlatformCreate): Promise<Platform> =>
    request<Platform>("/admin/platforms", { method: "POST", token, body }),

  update: (
    { token }: Auth,
    id: string,
    body: PlatformUpdate,
  ): Promise<Platform> =>
    request<Platform>(`/admin/platforms/${id}`, {
      method: "PATCH",
      token,
      body,
    }),

  remove: ({ token }: Auth, id: string): Promise<unknown> =>
    request(`/admin/platforms/${id}`, { method: "DELETE", token }),
};

/* ---------- questions ---------- */

export const faqsApi = {
  list: ({ token }: Auth, query: ListQuery = {}): Promise<Paged<Faq>> =>
    requestPaged<Faq>("/admin/faqs", { token, query, ...FRESH }),

  create: ({ token }: Auth, body: FaqCreate): Promise<Faq> =>
    request<Faq>("/admin/faqs", { method: "POST", token, body }),

  update: ({ token }: Auth, id: string, body: FaqUpdate): Promise<Faq> =>
    request<Faq>(`/admin/faqs/${id}`, { method: "PATCH", token, body }),

  remove: ({ token }: Auth, id: string): Promise<unknown> =>
    request(`/admin/faqs/${id}`, { method: "DELETE", token }),
};

/* ---------- standalone pages ---------- */

/**
 * Pages written here rather than in the codebase.
 *
 * Privacy and terms arrive seeded and locked: they can be rewritten, but not
 * renamed, unpublished or deleted, because the footer of every page links to
 * them and a 404 there is a legal problem rather than a broken link.
 */
export const pagesApi = {
  list: ({ token }: Auth, query: ListQuery = {}): Promise<Paged<Page>> =>
    requestPaged<Page>("/admin/pages", { token, query, ...FRESH }),

  create: ({ token }: Auth, body: PageCreate): Promise<Page> =>
    request<Page>("/admin/pages", { method: "POST", token, body }),

  update: ({ token }: Auth, id: string, body: PageUpdate): Promise<Page> =>
    request<Page>(`/admin/pages/${id}`, { method: "PATCH", token, body }),

  remove: ({ token }: Auth, id: string): Promise<unknown> =>
    request(`/admin/pages/${id}`, { method: "DELETE", token }),
};

/* ---------- the site's own settings ---------- */

export const siteSettingsApi = {
  read: ({ token }: Auth): Promise<SiteSettings> =>
    request<SiteSettings>("/admin/site-settings", { token, ...FRESH }),

  save: ({ token }: Auth, body: SiteSettingsUpdate): Promise<SiteSettings> =>
    request<SiteSettings>("/admin/site-settings", {
      method: "PUT",
      token,
      body,
    }),
};

/* ---------- images ---------- */

export const imagesApi = {
  /**
   * Upload one image and get back the URL it is served at.
   *
   * FormData rather than JSON, because the alternative is base64 in a string
   * field: a third larger on the wire, and it puts the file through the JSON
   * parser for no benefit.
   */
  upload: (
    { token }: Auth,
    file: File,
    kind = "general",
  ): Promise<UploadedImage> => {
    const body = new FormData();
    body.append("file", file);
    body.append("kind", kind);
    return request<UploadedImage>("/admin/images", {
      method: "POST",
      token,
      body,
    });
  },
};
