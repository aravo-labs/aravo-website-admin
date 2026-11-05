"use client";

/**
 * The platform, day by day.
 *
 * Four series that answer different questions, with magnitudes an order apart:
 * a busy day is a handful of deliveries and several hundred API requests. Drawn
 * on one axis the deliveries flatten into the baseline and the chart says
 * nothing about the number anyone came to look at.
 *
 * So one series is charted at a time and the rest are read out on hover. That
 * also makes the hover worth doing: instead of a tooltip repeating the bar you
 * are already pointing at, it answers "what else happened that day" - which is
 * how you notice that the quiet Tuesday was quiet everywhere, or that requests
 * held up while deliveries fell.
 */

import { useState } from "react";

import { cx } from "@/components/ui";
import type { PlatformTrend as Point } from "@/lib/api/types";
import Link from "next/link";

type SeriesKey = "deliveries" | "batches" | "api_requests" | "api_errors";

const SERIES: Record<SeriesKey, { label: string; colour: string }> = {
  deliveries: { label: "Deliveries", colour: "var(--color-accent)" },
  batches: { label: "Sensor batches", colour: "var(--color-teal-400)" },
  api_requests: { label: "API requests", colour: "var(--color-sand-400)" },
  api_errors: { label: "Errors", colour: "var(--color-danger)" },
};

const ORDER: SeriesKey[] = ["deliveries", "batches", "api_requests", "api_errors"];

export function PlatformTrend({
  data,
  days,
  onDaysChange,
  loading,
}: {
  data: Point[];
  days: number;
  onDaysChange: (days: number) => void;
  loading?: boolean;
}) {
  const [series, setSeries] = useState<SeriesKey>("deliveries");
  const [hover, setHover] = useState<number | null>(null);

  const height = 190;
  const peak = Math.max(1, ...data.map((d) => d[series] ?? 0));
  const slot = data.length ? 100 / data.length : 100;
  const active = hover !== null ? data[hover] : null;

  const totals = ORDER.reduce<Record<SeriesKey, number>>(
    (acc, k) => ({ ...acc, [k]: data.reduce((n, d) => n + (d[k] ?? 0), 0) }),
    {} as Record<SeriesKey, number>,
  );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Series">
          {ORDER.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setSeries(k)}
              aria-pressed={series === k}
              className={cx(
                "flex items-center gap-2 rounded-[3px] border px-2.5 py-1.5",
                "font-mono text-[11px] tracking-wide uppercase transition-colors",
                series === k
                  ? "border-[var(--color-accent-border)] bg-[var(--color-accent-subtle)] text-[var(--color-text-brand)]"
                  : "border-transparent text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]",
              )}
            >
              <span
                aria-hidden="true"
                className="inline-block size-2 rounded-[1px]"
                style={{ background: SERIES[k].colour }}
              />
              {SERIES[k].label}
              <span className="tabular-nums opacity-60">
                {totals[k].toLocaleString()}
              </span>
            </button>
          ))}
        </div>

        <div className="flex gap-1" role="group" aria-label="Range">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => onDaysChange(d)}
              aria-pressed={days === d}
              className={cx(
                "rounded-[3px] px-2.5 py-1 font-mono text-[11px] uppercase transition-colors",
                days === d
                  ? "bg-[var(--color-text)] text-[var(--color-text-inverse)]"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]",
              )}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* The readout. Fixed height so the chart does not jump as the pointer
          moves on and off it. */}
      <div className="mt-5 flex min-h-[3.25rem] flex-wrap items-baseline gap-x-6 gap-y-1">
        {active ? (
          <>
            <span className="font-mono text-[11px] tracking-wide text-[var(--color-text-subtle)] uppercase">
              {new Date(active.day).toLocaleDateString([], {
                weekday: "short",
                day: "numeric",
                month: "short",
              })}
            </span>
            {ORDER.map((k) => (
              <span key={k} className="flex items-baseline gap-1.5">
                <span
                  aria-hidden="true"
                  className="inline-block size-2 rounded-[1px]"
                  style={{ background: SERIES[k].colour }}
                />
                <span className="text-[1.05rem] text-[var(--color-text)] tabular-nums">
                  {(active[k] ?? 0).toLocaleString()}
                </span>
                <span className="text-[12px] text-[var(--color-text-muted)]">
                  {SERIES[k].label.toLowerCase()}
                </span>
              </span>
            ))}
          </>
        ) : (
          <span className="text-[13px] text-[var(--color-text-muted)]">
            {loading
              ? "Loading…"
              : "Point at a day to see what else happened on it, or open it."}
          </span>
        )}
      </div>

      <div
        className="relative mt-2"
        onMouseLeave={() => setHover(null)}
        style={{ height }}
      >
        <svg
          viewBox={`0 0 100 ${height}`}
          preserveAspectRatio="none"
          className="h-full w-full"
          role="img"
          aria-label={`${SERIES[series].label} a day over ${data.length} days, peaking at ${peak}.`}
        >
          {[0.25, 0.5, 0.75, 1].map((f) => (
            <line
              key={f}
              x1="0"
              x2="100"
              y1={height - f * height}
              y2={height - f * height}
              stroke="var(--color-border)"
              strokeWidth="0.5"
              vectorEffect="non-scaling-stroke"
            />
          ))}

          {data.map((d, i) => {
            const value = d[series] ?? 0;
            const h = value === 0 ? 1.5 : (value / peak) * (height - 10);
            const w = Math.max(1.2, slot * 0.62);
            return (
              <rect
                key={d.day}
                x={i * slot + (slot - w) / 2}
                y={height - h}
                width={w}
                height={h}
                fill={value === 0 ? "var(--color-border-strong)" : SERIES[series].colour}
                opacity={hover === null || hover === i ? 1 : 0.45}
              />
            );
          })}
        </svg>

          {/* Hit areas over the bars. Full height, so a day with a one-pixel bar
              is as easy to point at as the busiest one.

              Links rather than buttons: the chart said two deliveries happened
              on the 23rd and there was no way to see which two. Each day now
              opens the delivery list already filtered to it. */}
          <div className="absolute inset-0 flex">
            {data.map((d, i) => (
              <Link
                key={d.day}
                href={`/deliveries?on=${d.day}`}
                aria-label={`${d.day}: ${d[series]} ${SERIES[series].label.toLowerCase()}. Open this day.`}
                className="h-full flex-1 cursor-pointer focus:outline-none focus-visible:bg-[var(--color-accent-subtle)]"
                style={{ opacity: 0.001 }}
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
              />
            ))}
          </div>
      </div>

      <div className="mt-2 flex justify-between font-mono text-[10px] text-[var(--color-text-subtle)] tabular-nums">
        <span>{short(data[0]?.day)}</span>
        <span>{short(data[data.length - 1]?.day)}</span>
      </div>
    </div>
  );
}

function short(day?: string): string {
  if (!day) return "";
  const d = new Date(day);
  return Number.isFinite(d.getTime())
    ? d.toLocaleDateString([], { day: "numeric", month: "short" })
    : day;
}
