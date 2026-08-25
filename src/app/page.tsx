"use client";

import Link from "next/link";

import {
  Badge,
  Card,
  ErrorState,
  LoadingState,
  PageHeader,
} from "@/components/ui";
import {
  applicationsApi,
  bannersApi,
  jobsApi,
  sdkRequestsApi,
  teamApi,
} from "@/lib/api/admin";
import { useAuth } from "@/lib/adminAuth";
import { useAsync } from "@/lib/useAsync";

export default function OverviewPage() {
  const { token } = useAuth();

  const state = useAsync(async () => {
    const auth = { token };
    // One page load, six counts. Fired together rather than in sequence so the
    // overview is one round trip's worth of latency, not six.
    const [jobs, publishedJobs, applications, newApplications, sdk, team, banners] =
      await Promise.all([
        jobsApi.list(auth, { page_size: 1 }),
        jobsApi.list(auth, { page_size: 1, status: "published" }),
        applicationsApi.list(auth, { page_size: 1 }),
        applicationsApi.list(auth, { page_size: 1, status: "new" }),
        sdkRequestsApi.list(auth, { page_size: 1, status: "new" }),
        teamApi.list(auth, { page_size: 1 }),
        bannersApi.list(auth, { page_size: 1, status: "published" }),
      ]);
    return {
      jobs: jobs.pagination?.total_items ?? 0,
      publishedJobs: publishedJobs.pagination?.total_items ?? 0,
      applications: applications.pagination?.total_items ?? 0,
      newApplications: newApplications.pagination?.total_items ?? 0,
      newSdk: sdk.pagination?.total_items ?? 0,
      team: team.pagination?.total_items ?? 0,
      liveBanner: (banners.pagination?.total_items ?? 0) > 0,
    };
  }, [token]);

  if (state.loading) return <LoadingState label="Loading overview" />;
  if (state.error)
    return (
      <ErrorState
        message={state.error.message}
        code={state.error.code}
        requestId={state.error.requestId}
        onRetry={state.reload}
      />
    );

  const s = state.data!;

  const cards = [
    {
      href: "/jobs",
      label: "Open roles",
      value: s.publishedJobs,
      note: `${s.jobs} total including drafts`,
    },
    {
      href: "/applications",
      label: "Applications",
      value: s.applications,
      note: s.newApplications > 0 ? `${s.newApplications} awaiting review` : "All triaged",
      urgent: s.newApplications > 0,
    },
    {
      href: "/sdk-requests",
      label: "SDK requests",
      value: s.newSdk,
      note: s.newSdk > 0 ? "Awaiting a reply" : "Nothing new",
      urgent: s.newSdk > 0,
    },
    {
      href: "/team",
      label: "Team members",
      value: s.team,
      note: "On the public team page",
    },
  ];

  return (
    <>
      <PageHeader
        title="Overview"
        description="What is live, and what is waiting on you."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Link key={card.href} href={card.href} className="group">
            <Card className="h-full transition-shadow hover:shadow-[var(--shadow-md)]">
              <p className="font-mono text-[length:var(--text-2xs)] tracking-[0.06em] text-[var(--color-text-subtle)] uppercase">
                {card.label}
              </p>
              <p className="mt-3 font-[family-name:var(--font-display)] text-[length:var(--text-3xl)] leading-none font-medium">
                {card.value}
              </p>
              <p
                className={
                  card.urgent
                    ? "mt-2 text-[length:var(--text-xs)] text-[var(--color-accent)]"
                    : "mt-2 text-[length:var(--text-xs)] text-[var(--color-text-muted)]"
                }
              >
                {card.note}
              </p>
            </Card>
          </Link>
        ))}
      </div>

      <Card className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-[length:var(--text-base)] font-medium">
              Portfolio banner
            </h2>
            <p className="mt-1 text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
              {s.liveBanner
                ? "A banner is live on the site."
                : "No banner is live. The site renders without one."}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge tone={s.liveBanner ? "success" : "neutral"}>
              {s.liveBanner ? "Live" : "None"}
            </Badge>
            <Link
              href="/banners"
              className="text-[length:var(--text-sm)] text-[var(--color-accent)] underline underline-offset-2 hover:no-underline"
            >
              Manage
            </Link>
          </div>
        </div>
      </Card>
    </>
  );
}
