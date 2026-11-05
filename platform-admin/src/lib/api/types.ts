/**
 * API response interfaces.
 *
 * Named re-exports of the types in `schema.d.ts`, which is generated from the
 * platform API's `openapi.json`. Nothing in the app should reach into
 * `components["schemas"][...]` directly: import from here, and a contract
 * change surfaces as a TypeScript error in one file rather than a runtime
 * surprise scattered across components.
 *
 * To regenerate after a backend change:
 *   (api)   .venv/bin/python -c "import json; from app.main import app; \
 *             json.dump(app.openapi(), open('openapi.json','w'), indent=2, sort_keys=True)"
 *   (admin) npm run api:types
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

/* ---------- platform ---------- */

export type SystemOverview = S["SystemOverview"];
export type PlatformTrend = S["PlatformTrendPoint"];
export type CompanySummary = S["CompanySummary"];
export type ApiKeySummary = S["ApiKeySummary"];
export type AuditEntry = S["AuditEntry"];
export type AdminUserRow = S["AdminUserRow"];
export type AdminDeliveryRow = S["AdminDeliveryRow"];

export type ClearPreview = {
  counts: Record<string, number>;
  confirmation_sent_to: string | null;
  keeps: string[];
};

export type ClearRequested = {
  sent_to: string;
  expires_in_minutes: number;
  counts: Record<string, number>;
};
export type AdminKeyRow = S["AdminKeyRow"];
export type AdminCompanyRow = S["AdminCompanyRow"];
export type Company = S["CompanyRead"];
export type CompanyStatusUpdate = S["CompanyStatusUpdate"];
export type Member = S["MemberRead"];
export type PlatformAdmin = S["PlatformAdminRead"];
export type Device = S["DeviceRead"];
export type Delivery = S["DeliveryRead"];
export type DeliveryDetail = S["DeliveryDetail"];
export type SensorBatch = S["SensorBatchRead"];
export type UsagePoint = S["UsagePoint"];
export type DeliveryCounts = S["DeliveryCounts"];
export type UsageSummary = S["UsageSummary"];
export type SdkConfig = S["ConfigRead"];

/** The statuses a company can be put into from this panel. */
export type CompanyStatus = "pending" | "active" | "suspended";

/**
 * What a delivery can be.
 *
 * `processing` and `inconclusive` are not error states and should not be
 * rendered as ones. A delivery is `processing` while its batches are still
 * being read, and `inconclusive` when the sensor data could not be used -
 * which happens when a phone was off, in a bag, or force closed, and is a real
 * outcome rather than a fault.
 */
export type DeliveryStatus =
  | "created"
  | "started"
  | "tracking"
  | "completed"
  | "processing"
  | "processed"
  | "inconclusive"
  | "failed"
  | "cancelled";
