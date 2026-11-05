"use client";

/**
 * The screen for what handsets collect.
 *
 * One editor serves both levels - the platform default and a single company -
 * because they are the same document with a different parent, and two screens
 * would be two places to get the override semantics wrong.
 *
 * The semantics are the whole design. A company stores only the settings it
 * differs on, so this edits the *overrides* and never the merged result.
 * Saving the merged document instead would pin the company to whatever the
 * defaults happened to be on the day somebody first opened this screen: every
 * later change to the platform default would stop reaching it, silently, and
 * the only clue would be a fleet that ignored a change nobody could see was
 * being ignored. So every row says which of the two it is, and the save sends
 * the short list.
 *
 * It also means a row needs three values, not one: what this level sets, what
 * it would inherit if it set nothing, and therefore what a handset is told
 * today. The API returns all three.
 */

import { useMemo, useState } from "react";

import {
  Badge,
  Button,
  Card,
  CardHeader,
  Input,
  Select,
  Textarea,
  cx,
} from "@/components/ui";
import { ApiRequestError } from "@/lib/api/client";
import type { SdkConfig } from "@/lib/api/types";
import {
  clearPath,
  hasPath,
  humanise,
  isObject,
  leaves,
  readPath,
  sameDocument,
  writePath,
  type Json,
  type JsonObject,
} from "@/lib/config/document";

/** Sections in the order somebody reaching for a dial would look for them. */
const SECTION_ORDER = [
  "misc",
  "location",
  "motion",
  "altitude",
  "wifi",
  "ble",
  "gnss",
  "remoteLogging",
];

const SECTION_LABEL: Record<string, string> = {
  misc: "General, batching and geofencing",
  location: "Location",
  motion: "Motion sensors",
  altitude: "Barometer",
  wifi: "Wi-Fi scanning",
  ble: "Bluetooth",
  gnss: "GNSS raw data",
  remoteLogging: "Remote logging",
};

/**
 * What the settings that can ruin a fleet actually cost.
 *
 * The API sends the limits; these say why the limit is there, because a range
 * on its own does not tell an administrator which end of it is dangerous.
 */
const SECTION_NOTE: Record<string, string> = {
  misc:
    "Batching decides how much a handset holds before it uploads, and how long it keeps data it could not send.",
  location: "A shorter interval is a more precise track and a shorter battery.",
  motion:
    "The heaviest streams here. At 100 Hz a seven minute delivery is around 1.4 MB per handset.",
  wifi: "Aggressive scanning is the single fastest way to flatten a phone.",
  ble: "Off by default. Turning it on starts a scan that runs for the whole delivery.",
  remoteLogging: "Diagnostics. Worth turning on for one company at a time.",
};

/**
 * Settings that are a choice between named values rather than free text.
 *
 * Typing these by hand was how `dsdp` got set: the field took any string, so a
 * value the handset does not understand looked exactly like a valid one until
 * batches started failing. A list cannot be mistyped.
 */
export const CHOICES: Record<string, { value: string; label: string }[]> = {
  "misc.payloadFormat": [
    // Lower case, because these are the literal strings the handset sends and
    // reads back. Title casing them invited the question of whether "JSON"
    // and "json" were the same setting.
    { value: "json", label: "json" },
    { value: "v3", label: "v3" },
    { value: "dsdp", label: "dsdp" },
  ],
};

type Props = {
  data: SdkConfig;
  /** Returns the saved document, so the editor can rebase on the server's copy. */
  onSave: (overrides: JsonObject) => Promise<SdkConfig>;
  /** "the platform default" or a company name, for the sentences on screen. */
  scope: string;
  /** What this level inherits from, named: "the shipped defaults" or "the platform default". */
  parentName: string;
};

export function ConfigEditor({ data, onSave, scope, parentName }: Props) {
  const saved = data.overrides as JsonObject;
  const inherited = data.inherited as JsonObject;
  const bounds = data.bounds;

  const [draft, setDraft] = useState<JsonObject>(saved);
  // Raw text for number fields, so a half-typed value is not committed as NaN
  // and clearing a field is an error rather than a silent zero.
  const [typed, setTyped] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<string[]>([]);
  const [mode, setMode] = useState<"form" | "json">("form");
  const [jsonText, setJsonText] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiRequestError | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  /**
   * What a handset would be told if this draft were saved.
   *
   * The draft laid over what this level inherits - the same merge the API
   * performs, so the row values on screen are the ones that would ship.
   */
  const effectiveNow = useMemo(
    () =>
      leaves(draft).reduce<JsonObject>(
        (acc, leaf) => writePath(acc, leaf.path, leaf.value),
        inherited,
      ),
    [draft, inherited],
  );

  const allLeaves = useMemo(() => leaves(effectiveNow), [effectiveNow]);

  /**
   * Everything wrong with the draft right now, by path.
   *
   * Derived rather than stored. A validity flag kept in state is a flag that
   * survives the change that fixed it, and the symptom is a save button that
   * stays disabled for no visible reason.
   */
  const issues = useMemo(() => {
    const out: Record<string, string> = {};

    for (const [path, raw] of Object.entries(typed)) {
      if (raw.trim() === "") out[path] = "Enter a number.";
      else if (!Number.isFinite(Number(raw))) out[path] = "Not a number.";
    }

    for (const leaf of leaves(draft)) {
      const limit = bounds[leaf.path];
      if (!limit) continue;
      const value = Number(leaf.value);
      if (!Number.isFinite(value)) continue;
      if (value < limit.min || value > limit.max) {
        out[leaf.path] = `Must be between ${limit.min} and ${limit.max}.`;
      }
    }
    return out;
  }, [typed, draft, bounds]);

  const dirty = !sameDocument(draft, saved);
  const overrideCount = leaves(draft).length;
  const blocked = Object.keys(issues).length > 0;

  function set(path: string, value: Json) {
    setSavedNotice(null);
    setDraft((d) => writePath(d, path, value));
  }

  function revert(path: string) {
    setSavedNotice(null);
    setDraft((d) => clearPath(d, path));
    setTyped((t) => {
      const next = { ...t };
      delete next[path];
      return next;
    });
  }

  function discard() {
    setDraft(saved);
    setTyped({});
    setError(null);
    setSavedNotice(null);
  }

  async function save(overrides: JsonObject) {
    setSaving(true);
    setError(null);
    try {
      const next = await onSave(overrides);
      // Rebase on what the server stored rather than on what was sent: the
      // two differ if anything was normalised, and keeping the sent copy
      // would leave the editor insisting it still had unsaved changes.
      setDraft(next.overrides as JsonObject);
      setTyped({});
      setJsonError(null);
      setSavedNotice(
        leaves(next.overrides as JsonObject).length === 0
          ? `Saved. ${startSentence(scope)} now inherits everything from ${parentName}.`
          : `Saved. Handsets pick this up on their next start.`,
      );
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? err
          : new ApiRequestError({
              code: "INTERNAL_ERROR",
              message: "Something went wrong.",
              status: 0,
            }),
      );
    } finally {
      setSaving(false);
    }
  }

  function openJson() {
    setJsonText(JSON.stringify(draft, null, 2));
    setJsonError(null);
    setMode("json");
  }

  function applyJson() {
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch (err) {
      setJsonError(err instanceof Error ? err.message : "That is not valid JSON.");
      return;
    }
    if (!isObject(parsed)) {
      setJsonError("The top level must be an object.");
      return;
    }
    setDraft(parsed);
    setTyped({});
    setJsonError(null);
    setMode("form");
  }

  return (
    <div className="flex flex-col gap-5">
      <Summary
        data={data}
        scope={scope}
        parentName={parentName}
        overrideCount={overrideCount}
      />

      {savedNotice && (
        <p className="rounded-[var(--radius-md)] bg-[var(--color-accent-subtle)] px-3 py-2 text-[length:var(--text-sm)] text-[var(--color-teal-700)]">
          {savedNotice}
        </p>
      )}

      {error && (
        <div className="rounded-[var(--radius-md)] bg-[var(--color-danger-50)] px-3 py-2 text-[length:var(--text-sm)] text-[var(--color-danger-700)]">
          <p>{error.formMessage ?? error.message}</p>
          {Object.entries(error.fieldErrors).map(([field, message]) => (
            <p key={field} className="font-mono text-[length:var(--text-xs)]">
              {field}: {message}
            </p>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-1">
          <Button
            size="sm"
            variant={mode === "form" ? "secondary" : "ghost"}
            onClick={() => setMode("form")}
          >
            Settings
          </Button>
          <Button
            size="sm"
            variant={mode === "json" ? "secondary" : "ghost"}
            onClick={openJson}
          >
            JSON
          </Button>
        </div>

        {mode === "form" && (
          <button
            type="button"
            onClick={() =>
              setOpen(open.length ? [] : SECTION_ORDER.concat(Object.keys(effectiveNow)))
            }
            className="text-[length:var(--text-xs)] text-[var(--color-text-muted)] underline underline-offset-2 hover:text-[var(--color-text)]"
          >
            {open.length ? "Collapse all" : "Expand all"}
          </button>
        )}
      </div>

      {mode === "json" ? (
        <Card>
          <CardHeader
            title="The overrides, as stored"
            description={`Only what ${scope} changes. Anything omitted is inherited from ${parentName}. This is the way to set a key the form does not know about yet.`}
          />
          <div className="flex flex-col gap-3 p-4 pt-0">
            <Textarea
              rows={18}
              value={jsonText}
              invalid={!!jsonError}
              spellCheck={false}
              onChange={(e) => {
                setJsonText(e.target.value);
                setJsonError(null);
              }}
              className="font-mono text-[length:var(--text-xs)]"
            />
            {jsonError && (
              <p className="text-[length:var(--text-xs)] text-[var(--color-danger-700)]">
                {jsonError}
              </p>
            )}
            <div className="flex gap-2">
              <Button size="sm" onClick={applyJson}>
                Use this
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setMode("form")}>
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {sectionsOf(effectiveNow).map((section) => {
            const sectionLeaves = allLeaves.filter(
              (l) => l.path === section || l.path.startsWith(`${section}.`),
            );
            const setHere = sectionLeaves.filter((l) => hasPath(draft, l.path)).length;
            const expanded = open.includes(section);

            return (
              <Card key={section}>
                <button
                  type="button"
                  onClick={() =>
                    setOpen((o) =>
                      o.includes(section)
                        ? o.filter((s) => s !== section)
                        : [...o, section],
                    )
                  }
                  className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
                >
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="flex items-center gap-2">
                      <span className="text-[length:var(--text-sm)] font-medium">
                        {SECTION_LABEL[section] ?? humanise(section)}
                      </span>
                      {setHere > 0 && (
                        <Badge tone="brand">
                          {setHere} set here
                        </Badge>
                      )}
                    </span>
                    {SECTION_NOTE[section] && (
                      <span className="text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
                        {SECTION_NOTE[section]}
                      </span>
                    )}
                  </span>
                  <span className="flex shrink-0 items-center gap-2 text-[length:var(--text-xs)] text-[var(--color-text-subtle)]">
                    {sectionLeaves.length}
                    <span aria-hidden className={cx("transition-transform", expanded && "rotate-180")}>
                      ▾
                    </span>
                  </span>
                </button>

                {expanded && (
                  <div className="border-t border-[var(--color-border)]">
                    {groupsOf(sectionLeaves, section).map((group) => (
                      <div key={group.parent}>
                        {group.parent !== section && (
                          <p className="bg-[var(--color-surface-hover)] px-4 py-1.5 font-mono text-[length:var(--text-2xs)] tracking-[0.06em] text-[var(--color-text-subtle)] uppercase">
                            {group.parent.slice(section.length + 1)}
                          </p>
                        )}
                        {group.paths.map((path) => (
                          <Row
                            key={path}
                            path={path}
                            value={readPath(effectiveNow, path) as Json}
                            inheritedValue={readPath(inherited, path) as Json}
                            overridden={hasPath(draft, path)}
                            limit={bounds[path]}
                            issue={issues[path]}
                            typed={typed[path]}
                            parentName={parentName}
                            onChange={(v) => set(path, v)}
                            onTyped={(raw) =>
                              setTyped((t) => ({ ...t, [path]: raw }))
                            }
                            onRevert={() => revert(path)}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {(dirty || saving) && (
        <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-4 py-3 shadow-[var(--shadow-md)]">
          <p className="text-[length:var(--text-sm)]">
            {blocked ? (
              <span className="text-[var(--color-danger-700)]">
                {Object.keys(issues).length === 1
                  ? "One setting is out of range."
                  : `${Object.keys(issues).length} settings are out of range.`}
              </span>
            ) : (
              <>
                <span className="font-medium">{overrideCount}</span>{" "}
                {overrideCount === 1 ? "setting" : "settings"} set for {scope}, everything
                else inherited.
              </>
            )}
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={discard} disabled={saving}>
              Discard
            </Button>
            <Button
              size="sm"
              loading={saving}
              disabled={blocked}
              onClick={() => save(draft)}
            >
              Save
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

/**
 * `scope` where a sentence starts.
 *
 * The name is written for the middle of a sentence - "set for the platform
 * default" - because that is where it appears most. A company name is already
 * capitalised and comes back unchanged; "the platform default" does not, and
 * read "set for The platform default" until this existed.
 */
function startSentence(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Known sections first, then anything the SDK has grown since. */
function sectionsOf(document: JsonObject): string[] {
  const present = Object.keys(document);
  const known = SECTION_ORDER.filter((s) => present.includes(s));
  return [...known, ...present.filter((s) => !SECTION_ORDER.includes(s)).sort()];
}

/**
 * Leaves grouped by the object that holds them, the section's own first.
 *
 * `misc` has thirty-five metadata flags under `collectMetadata` and nineteen
 * geofence settings under `geofence`. Flat, that is one list of seventy in
 * which the four that matter are invisible.
 */
function groupsOf(
  sectionLeaves: ReadonlyArray<{ path: string }>,
  section: string,
): Array<{ parent: string; paths: string[] }> {
  const byParent = new Map<string, string[]>();
  for (const { path } of sectionLeaves) {
    const parent = path.includes(".")
      ? path.slice(0, path.lastIndexOf("."))
      : section;
    const list = byParent.get(parent) ?? [];
    list.push(path);
    byParent.set(parent, list);
  }
  const own = byParent.get(section) ?? [];
  byParent.delete(section);
  return [
    ...(own.length ? [{ parent: section, paths: own }] : []),
    ...[...byParent.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([parent, paths]) => ({ parent, paths })),
  ];
}

function Summary({
  data,
  scope,
  parentName,
  overrideCount,
}: {
  data: SdkConfig;
  scope: string;
  parentName: string;
  overrideCount: number;
}) {
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4 p-4">
        <div className="min-w-0">
          <p className="text-[length:var(--text-sm)]">
            {overrideCount === 0 ? (
              <>
                {startSentence(scope)} sets nothing of its own and inherits all of{" "}
                {parentName}.
              </>
            ) : (
              <>
                {startSentence(scope)} overrides{" "}
                <span className="font-medium">{overrideCount}</span>{" "}
                {overrideCount === 1 ? "setting" : "settings"}; the rest comes from{" "}
                {parentName}.
              </>
            )}
          </p>
          <p className="mt-1 text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
            {data.changed.length === 0
              ? "Nothing differs from the configuration the SDK ships with."
              : `${data.changed.length} ${
                  data.changed.length === 1 ? "setting differs" : "settings differ"
                } from the configuration the SDK ships with.`}
          </p>
        </div>

        <dl className="flex shrink-0 gap-6 text-[length:var(--text-xs)]">
          <div>
            <dt className="text-[var(--color-text-subtle)]">Version</dt>
            <dd className="mt-0.5 font-mono">{data.version}</dd>
          </div>
          <div>
            <dt className="text-[var(--color-text-subtle)]">Last changed</dt>
            <dd className="mt-0.5">
              {data.updated_at
                ? new Date(data.updated_at).toLocaleString()
                : "Never"}
              {data.updated_by && (
                <span className="block text-[var(--color-text-subtle)]">
                  {data.updated_by}
                </span>
              )}
            </dd>
          </div>
        </dl>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */

type RowProps = {
  path: string;
  value: Json;
  inheritedValue: Json;
  overridden: boolean;
  limit?: { [key: string]: number };
  issue?: string;
  typed?: string;
  parentName: string;
  onChange: (value: Json) => void;
  onTyped: (raw: string) => void;
  onRevert: () => void;
};

function Row({
  path,
  value,
  inheritedValue,
  overridden,
  limit,
  issue,
  typed,
  parentName,
  onChange,
  onTyped,
  onRevert,
}: RowProps) {
  const key = path.slice(path.lastIndexOf(".") + 1);
  const choices = CHOICES[path];

  return (
    <div
      className={cx(
        "flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-[var(--color-border)] px-4 py-2.5 last:border-b-0",
        overridden && "bg-[var(--color-accent-subtle)]/35",
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-[length:var(--text-sm)]">
          <span className={cx(overridden && "font-medium")}>{humanise(key)}</span>
          {overridden && (
            <span
              aria-label="Set here"
              title="Set here, not inherited"
              className="size-1.5 shrink-0 rounded-full bg-[var(--color-accent)]"
            />
          )}
        </p>
        <p className="font-mono text-[length:var(--text-2xs)] text-[var(--color-text-subtle)]">
          {path}
        </p>
        {issue && (
          <p className="text-[length:var(--text-xs)] text-[var(--color-danger-700)]">
            {issue}
          </p>
        )}
        {!issue && limit && (
          <p className="text-[length:var(--text-xs)] text-[var(--color-text-subtle)]">
            {limit.min} to {limit.max}
          </p>
        )}
        {overridden && (
          // Under the label rather than beside the Revert button: the value is
          // the whole point of the sentence, and in the narrow right-hand
          // column a long parent name pushed it out of sight behind an
          // ellipsis - "the shipped defa…" told a reader nothing.
          <p className="text-[length:var(--text-xs)] text-[var(--color-text-subtle)]">
            {parentName}: {display(inheritedValue)}
          </p>
        )}
      </div>

      <div className="w-full sm:w-56">
        <Control
          value={value}
          typed={typed}
          invalid={!!issue}
          limit={limit}
          choices={choices}
          onChange={onChange}
          onTyped={onTyped}
        />
      </div>

      <div className="flex w-full items-center justify-between gap-2 sm:w-44 sm:justify-end">
        {overridden ? (
          <Button size="sm" variant="ghost" onClick={onRevert}>
            Revert
          </Button>
        ) : (
          <span className="text-[length:var(--text-2xs)] text-[var(--color-text-subtle)]">
            Inherited
          </span>
        )}
      </div>
    </div>
  );
}

function display(value: Json): string {
  if (typeof value === "boolean") return value ? "on" : "off";
  if (value === null || value === undefined) return "unset";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "empty";
  return String(value);
}

function Control({
  value,
  typed,
  invalid,
  limit,
  choices,
  onChange,
  onTyped,
}: {
  value: Json;
  typed?: string;
  invalid: boolean;
  limit?: { [key: string]: number };
  choices?: { value: string; label: string }[];
  onChange: (value: Json) => void;
  onTyped: (raw: string) => void;
}) {
  if (choices) {
    const known = choices.some((c) => c.value === value);
    return (
      <Select
        value={known ? String(value) : ""}
        onChange={(e) => onChange(e.target.value)}
      >
        {/* A value saved before this list existed still has to be shown,
            rather than silently reading as the first option. */}
        {!known && <option value="">{display(value)} (unrecognised)</option>}
        {choices.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </Select>
    );
  }

  if (typeof value === "boolean") {
    return (
      <Select
        value={value ? "on" : "off"}
        onChange={(e) => onChange(e.target.value === "on")}
      >
        <option value="on">On</option>
        <option value="off">Off</option>
      </Select>
    );
  }

  if (typeof value === "number") {
    return (
      <Input
        type="number"
        inputMode="decimal"
        invalid={invalid}
        value={typed ?? String(value)}
        min={limit?.min}
        max={limit?.max}
        onChange={(e) => {
          const raw = e.target.value;
          onTyped(raw);
          if (raw.trim() !== "" && Number.isFinite(Number(raw))) {
            onChange(Number(raw));
          }
        }}
      />
    );
  }

  if (Array.isArray(value)) {
    return (
      <Input
        value={value.join(", ")}
        placeholder="empty"
        onChange={(e) => {
          const parts = e.target.value
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
          onChange(parts);
        }}
      />
    );
  }

  return (
    <Input
      value={value === null ? "" : String(value)}
      invalid={invalid}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
