/**
 * API response interfaces.
 *
 * These are named re-exports of the types in `schema.d.ts`, which is generated
 * from the API's `openapi.json`. Nothing in the app should reach into
 * `components["schemas"][...]` directly: import from here, and a contract
 * change surfaces as a TypeScript error in one file rather than a runtime
 * surprise scattered across components.
 *
 * To regenerate after a backend change:
 *   (api)  .venv/bin/python scripts/export_openapi.py
 *   (web)  npm run api:types
 */

import type { components } from "./schema";

type S = components["schemas"];

/* ---------- envelope ---------- */

export type ApiError = S["ApiError"];
export type ErrorDetail = S["ErrorDetail"];
export type PaginationMeta = S["PaginationMeta"];
export type ResponseMeta = S["ResponseMeta"];

/** The shape every endpoint returns, success or failure. */
export type ApiResponse<T> = {
  success: boolean;
  data: T | null;
  error: ApiError | null;
  meta: ResponseMeta;
};

/* ---------- enums ---------- */

export type ContentStatus = S["ContentStatus"];
export type ApplicationStatus = S["ApplicationStatus"];
export type RequestStatus = S["RequestStatus"];
export type BannerVariant = S["BannerVariant"];

/* ---------- careers ---------- */

export type Job = S["JobRead"];
export type JobPublic = S["JobPublic"];
export type JobSummary = S["JobPublicSummary"];
export type JobCreate = S["JobCreate"];
export type JobUpdate = S["JobUpdate"];

export type Application = S["ApplicationRead"];
export type ApplicationCreate = S["ApplicationCreate"];
export type ApplicationUpdate = S["ApplicationUpdate"];
export type ApplicationReceipt = S["ApplicationReceipt"];
export type ResumeLink = S["ResumeLink"];

/* ---------- SDK ---------- */

export type SdkRequest = S["SdkRequestRead"];
export type SdkRequestCreate = S["SdkRequestCreate"];
export type SdkRequestUpdate = S["SdkRequestUpdate"];
export type SdkRequestReceipt = S["SdkRequestReceipt"];

export type DocPage = S["DocPageRead"];
export type DocPagePublic = S["DocPagePublic"];
export type DocPageSummary = S["DocPagePublicSummary"];
export type DocPageCreate = S["DocPageCreate"];
export type DocPageUpdate = S["DocPageUpdate"];

/* ---------- team and banners ---------- */

export type TeamMember = S["TeamMemberRead"];

/* ---------- platforms, questions, settings ---------- */

export type Platform = S["PlatformRead"];
export type PlatformCreate = S["PlatformCreate"];
export type PlatformUpdate = S["PlatformUpdate"];

export type Faq = S["FaqRead"];
export type FaqCreate = S["FaqCreate"];
export type FaqUpdate = S["FaqUpdate"];

export type Page = S["PageRead"];
export type PageCreate = S["PageCreate"];
export type PageUpdate = S["PageUpdate"];

export type SiteSettings = S["SiteSettingsRead"];
export type SiteSettingsUpdate = S["SiteSettingsUpdate"];

export type UploadedImage = S["UploadedImage"];
export type TeamMemberPublic = S["TeamMemberPublic"];
export type TeamMemberCreate = S["TeamMemberCreate"];
export type TeamMemberUpdate = S["TeamMemberUpdate"];

export type Banner = S["BannerRead"];
export type BannerPublic = S["BannerPublic"];
export type BannerItem = S["BannerItem"];
export type BannerCreate = S["BannerCreate"];
export type BannerUpdate = S["BannerUpdate"];

/* ---------- error codes ---------- */

/**
 * Stable, machine-readable error codes. Branch on these; `error.message` is
 * written for humans and may change without notice.
 */
export const ERROR_CODES = [
  "VALIDATION_ERROR",
  "BAD_REQUEST",
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "UNPROCESSABLE",
  "RATE_LIMITED",
  "PAYLOAD_TOO_LARGE",
  "UNSUPPORTED_MEDIA_TYPE",
  "INTERNAL_ERROR",
  "SERVICE_UNAVAILABLE",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

/* ---- Mail server settings ---- */

export type SmtpSettings = S["SmtpSettingsRead"];
export type SmtpSettingsUpdate = S["SmtpSettingsUpdate"];
export type SmtpSecurity = SmtpSettings["security"];
