"use client";

/**
 * The component library.
 *
 * Everything the admin panel renders comes from here. The rule that keeps it
 * useful: a component may only read semantic tokens, never a hex value and
 * never a primitive. If a screen needs a shade that is not in the system, the
 * fix is a token, not a one-off class.
 *
 * Variants are closed sets rather than open `className` overrides. That is a
 * deliberate constraint: it means a button cannot quietly become a
 * seventeenth kind of button, and restyling every button is one edit here.
 */

import type { ReactNode } from "react";
import { forwardRef, useEffect, useId, useRef, useState } from "react";

export type Tone = "brand" | "neutral" | "success" | "warning" | "danger" | "info";
export type Size = "sm" | "md" | "lg";

/** Join class names, dropping falsy entries. */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/* ==========================================================================
   Button
   ========================================================================== */

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-[var(--control-radius)] " +
  "font-medium whitespace-nowrap transition-colors duration-[var(--duration-fast)] " +
  "disabled:pointer-events-none disabled:opacity-50";

const BUTTON_VARIANTS = {
  primary:
    "bg-[var(--color-accent)] text-[var(--color-text-inverse)] hover:bg-[var(--color-accent-hover)]",
  secondary:
    "border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]",
  ghost:
    "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]",
  danger:
    "bg-[var(--color-danger-500)] text-[var(--color-text-inverse)] hover:bg-[var(--color-danger-700)]",
  link: "text-[var(--color-accent)] underline underline-offset-2 hover:no-underline",
} as const;

const BUTTON_SIZES = {
  sm: "h-[var(--control-height-sm)] px-3 text-[length:var(--text-sm)]",
  md: "h-[var(--control-height-md)] px-4 text-[length:var(--text-sm)]",
  lg: "h-[var(--control-height-lg)] px-6 text-[length:var(--text-base)]",
} as const;

export type ButtonProps = {
  variant?: keyof typeof BUTTON_VARIANTS;
  size?: Size;
  loading?: boolean;
  iconOnly?: boolean;
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    loading = false,
    iconOnly = false,
    className,
    children,
    disabled,
    ...rest
  },
  ref
) {
  return (
    <button
      ref={ref}
      // A loading button stays disabled: the most common double-submit is a
      // second click while the first request is still in flight.
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        BUTTON_BASE,
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        iconOnly && "aspect-square px-0",
        className
      )}
      {...rest}
    >
      {loading && <Spinner size="sm" />}
      {children}
    </button>
  );
});

/* ==========================================================================
   Spinner
   ========================================================================== */

export function Spinner({ size = "md" }: { size?: Size }) {
  const px = { sm: 14, md: 18, lg: 24 }[size];
  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 24 24"
      fill="none"
      className="animate-spin"
      role="status"
      aria-label="Loading"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ==========================================================================
   Badge
   ========================================================================== */

const BADGE_TONES: Record<Tone, string> = {
  brand:
    "bg-[var(--color-accent-subtle)] text-[var(--color-teal-700)] border-[var(--color-accent-border)]",
  neutral:
    "bg-[var(--color-surface-sunken)] text-[var(--color-text-muted)] border-[var(--color-border)]",
  success:
    "bg-[var(--color-success-50)] text-[var(--color-success-700)] border-[color-mix(in_srgb,var(--color-success-500)_25%,transparent)]",
  warning:
    "bg-[var(--color-warning-50)] text-[var(--color-warning-700)] border-[color-mix(in_srgb,var(--color-warning-500)_25%,transparent)]",
  danger:
    "bg-[var(--color-danger-50)] text-[var(--color-danger-700)] border-[color-mix(in_srgb,var(--color-danger-500)_25%,transparent)]",
  info: "bg-[var(--color-info-50)] text-[var(--color-info-700)] border-[color-mix(in_srgb,var(--color-info-500)_25%,transparent)]",
};

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-[var(--radius-full)] border px-2.5 py-0.5",
        "font-mono text-[length:var(--text-2xs)] tracking-[0.04em] uppercase",
        BADGE_TONES[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

/* ==========================================================================
   Surfaces
   ========================================================================== */

export function Card({
  children,
  className,
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div
      className={cx(
        "rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)]",
        "shadow-[var(--shadow-xs)]",
        padded && "p-6",
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div>
        <h2 className="font-[family-name:var(--font-display)] text-[length:var(--text-lg)] font-medium text-[var(--color-text)]">
          {title}
        </h2>
        {description && (
          <p className="mt-1 text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ==========================================================================
   Form controls
   ========================================================================== */

const FIELD_BASE =
  "w-full rounded-[var(--control-radius)] border bg-[var(--color-surface)] " +
  "px-3 text-[length:var(--text-sm)] text-[var(--color-text)] " +
  "placeholder:text-[var(--color-text-subtle)] " +
  "transition-colors duration-[var(--duration-fast)] " +
  "disabled:cursor-not-allowed disabled:bg-[var(--color-surface-sunken)]";

function fieldTone(invalid?: boolean) {
  return invalid
    ? "border-[var(--color-danger-500)]"
    : "border-[var(--color-border)] focus:border-[var(--color-border-focus)]";
}

/**
 * Label + control + message, wired together.
 *
 * The id is generated here and threaded into the control, so `htmlFor` and
 * `aria-describedby` are always correct rather than depending on each caller
 * remembering to pass a unique string.
 */
export function Field({
  label,
  hint,
  error,
  required,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: (props: {
    id: string;
    "aria-describedby"?: string;
    "aria-invalid"?: boolean;
    "aria-required"?: boolean;
  }) => ReactNode;
}) {
  const id = useId();
  const messageId = `${id}-message`;
  const message = error ?? hint;

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="text-[length:var(--text-sm)] font-medium text-[var(--color-text)]"
      >
        {label}
        {required && (
          <span className="ml-0.5 text-[var(--color-accent)]" aria-hidden>
            *
          </span>
        )}
      </label>
      {children({
        id,
        "aria-describedby": message ? messageId : undefined,
        "aria-invalid": error ? true : undefined,
        "aria-required": required || undefined,
      })}
      {message && (
        <p
          id={messageId}
          className={cx(
            "text-[length:var(--text-xs)]",
            error ? "text-[var(--color-danger-700)]" : "text-[var(--color-text-muted)]"
          )}
        >
          {message}
        </p>
      )}
    </div>
  );
}

export const Input = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }
>(function Input({ className, invalid, ...rest }, ref) {
  return (
    <input
      ref={ref}
      className={cx(FIELD_BASE, fieldTone(invalid), "h-[var(--control-height-md)]", className)}
      {...rest}
    />
  );
});

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }
>(function Textarea({ className, invalid, rows = 4, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cx(FIELD_BASE, fieldTone(invalid), "resize-y py-2 leading-relaxed", className)}
      {...rest}
    />
  );
});

export const Select = forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }
>(function Select({ className, invalid, children, ...rest }, ref) {
  return (
    <select
      ref={ref}
      className={cx(
        FIELD_BASE,
        fieldTone(invalid),
        "h-[var(--control-height-md)] cursor-pointer appearance-none",
        // room for the chevron drawn by the background image
        "bg-[length:16px] bg-[right_0.6rem_center] bg-no-repeat pr-9",
        className
      )}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23625d55' stroke-width='2' stroke-linecap='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
      }}
      {...rest}
    >
      {children}
    </select>
  );
});

/**
 * A list of short text values edited as one control.
 *
 * The API stores responsibilities, requirements and so on as string arrays.
 * A textarea split on newlines is the honest editing affordance for that:
 * it matches how people actually type a list, and avoids a row of inputs
 * that has to grow and shrink.
 */
export function BulletListInput({
  value,
  onChange,
  placeholder,
  rows = 5,
  id,
  ...aria
}: {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  rows?: number;
  id?: string;
} & Record<string, unknown>) {
  return (
    <Textarea
      id={id}
      rows={rows}
      placeholder={placeholder}
      value={value.join("\n")}
      onChange={(e) =>
        onChange(
          e.target.value
            .split("\n")
            // keep blank lines while typing; the API strips them on save
            .map((line) => line.replace(/^[-•*]\s*/, ""))
        )
      }
      {...aria}
    />
  );
}

/* ==========================================================================
   Table
   ========================================================================== */

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)]">
      <table className="w-full border-collapse text-left">{children}</table>
    </div>
  );
}

export function Th({
  children,
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={cx(
        "border-b border-[var(--color-border)] px-4 py-3",
        "font-mono text-[length:var(--text-2xs)] font-normal tracking-[0.06em] uppercase",
        "text-[var(--color-text-subtle)]",
        className
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <td
      className={cx(
        "border-b border-[var(--color-border)] px-4 py-3 text-[length:var(--text-sm)]",
        className
      )}
    >
      {children}
    </td>
  );
}

export function Tr({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <tr
      onClick={onClick}
      className={cx(
        "last:[&>td]:border-b-0",
        onClick && "cursor-pointer transition-colors hover:bg-[var(--color-surface-hover)]"
      )}
    >
      {children}
    </tr>
  );
}

/* ==========================================================================
   Empty, loading and error states
   ========================================================================== */

/**
 * Every list screen needs all three of these, and they are the states most
 * often skipped. Having them in the library makes doing it properly the
 * path of least resistance.
 */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <div className="grid size-11 place-items-center rounded-[var(--radius-full)] bg-[var(--color-surface-sunken)]">
        <svg viewBox="0 0 24 24" className="size-5 text-[var(--color-text-subtle)]" fill="none">
          <path
            d="M4 7h16M4 12h10M4 17h7"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <h3 className="font-[family-name:var(--font-display)] text-[length:var(--text-base)] font-medium">
        {title}
      </h3>
      {description && (
        <p className="max-w-sm text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
          {description}
        </p>
      )}
      {action}
    </div>
  );
}

export function LoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 px-6 py-16 text-[var(--color-text-muted)]">
      <Spinner />
      <span className="text-[length:var(--text-sm)]">{label}…</span>
    </div>
  );
}

export function ErrorState({
  message,
  code,
  requestId,
  onRetry,
}: {
  message: string;
  code?: string;
  requestId?: string | null;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <div className="grid size-11 place-items-center rounded-[var(--radius-full)] bg-[var(--color-danger-50)]">
        <svg viewBox="0 0 24 24" className="size-5 text-[var(--color-danger-500)]" fill="none">
          <path
            d="M12 8v5m0 3.5v.01M10.3 4.3 2.9 17a2 2 0 0 0 1.7 3h14.8a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <h3 className="font-[family-name:var(--font-display)] text-[length:var(--text-base)] font-medium">
        {message}
      </h3>
      {/* The request id is what makes a bug report actionable, so it is shown
          rather than buried in a console log. */}
      {requestId && (
        <p className="font-mono text-[length:var(--text-2xs)] text-[var(--color-text-subtle)]">
          {code} · {requestId}
        </p>
      )}
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

/* ==========================================================================
   Tabs
   ========================================================================== */

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: ReadonlyArray<{ id: T; label: string; count?: number }>;
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div role="tablist" className="flex gap-1 border-b border-[var(--color-border)]">
      {tabs.map((tab) => {
        const active = tab.id === value;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={cx(
              "relative px-3 py-2.5 text-[length:var(--text-sm)] transition-colors",
              active
                ? "text-[var(--color-text)]"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            )}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className="ml-1.5 font-mono text-[length:var(--text-2xs)] text-[var(--color-text-subtle)]">
                {tab.count}
              </span>
            )}
            <span
              className={cx(
                "absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-[var(--color-accent)] transition-transform duration-[var(--duration-base)]",
                active ? "scale-x-100" : "scale-x-0"
              )}
            />
          </button>
        );
      })}
    </div>
  );
}

/* ==========================================================================
   Modal
   ========================================================================== */

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  size?: Size;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    // Stop the page behind from scrolling while a modal is over it.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  const width = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-3xl" }[size];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-[rgba(26,25,23,0.45)] backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cx(
          "relative w-full rounded-[var(--radius-xl)] border border-[var(--color-border)]",
          "bg-[var(--color-surface)] shadow-[var(--shadow-lg)]",
          width
        )}
        style={{ animation: "ds-modal-in var(--duration-base) var(--ease-out) both" }}
      >
        <div className="border-b border-[var(--color-border)] px-6 py-5">
          <h2 className="font-[family-name:var(--font-display)] text-[length:var(--text-lg)] font-medium">
            {title}
          </h2>
          {description && (
            <p className="mt-1 text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
              {description}
            </p>
          )}
        </div>
        {children && <div className="px-6 py-5">{children}</div>}
        {footer && (
          <div className="flex justify-end gap-2 border-t border-[var(--color-border)] px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/* ==========================================================================
   Toast
   ========================================================================== */

export type Toast = { id: number; tone: Tone; message: string };

/**
 * Minimal toast queue.
 *
 * Deliberately not a context provider: the admin panel shows toasts from one
 * place per screen, and a provider would add indirection without removing any
 * work at the call site.
 */
export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  function push(message: string, tone: Tone = "success") {
    const id = nextId.current++;
    setToasts((all) => [...all, { id, tone, message }]);
    setTimeout(() => setToasts((all) => all.filter((t) => t.id !== id)), 4200);
  }

  return { toasts, push };
}

export function ToastStack({ toasts }: { toasts: Toast[] }) {
  return (
    <div
      className="pointer-events-none fixed right-5 bottom-5 z-[60] flex flex-col gap-2"
      role="status"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cx(
            "pointer-events-auto flex items-center gap-2.5 rounded-[var(--radius-md)] border px-4 py-3",
            "shadow-[var(--shadow-md)] text-[length:var(--text-sm)]",
            BADGE_TONES[t.tone]
          )}
          style={{ animation: "ds-toast-in var(--duration-base) var(--ease-spring) both" }}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}

/* ==========================================================================
   Pagination
   ========================================================================== */

export function Pagination({
  page,
  totalPages,
  totalItems,
  onChange,
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-4 pt-4">
      <span className="text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
        Page {page} of {totalPages} · {totalItems} total
      </span>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          Previous
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

/* ==========================================================================
   Page header
   ========================================================================== */

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-[length:var(--text-2xl)] font-medium tracking-[-0.01em] text-[var(--color-text)]">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
