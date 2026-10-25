import type { ReactNode } from "react";

export const cx = (...parts: (string | false | null | undefined)[]) =>
  parts.filter(Boolean).join(" ");

/* ---------------------------------------------------------------- buttons */

type Variant = "primary" | "secondary" | "ghost" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-on-accent hover:bg-accent-hover border-transparent",
  secondary: "bg-surface text-ink border-line-strong hover:bg-surface-2",
  ghost: "bg-transparent text-body border-transparent hover:bg-surface-2",
  danger: "bg-danger-soft text-danger border-transparent hover:brightness-95",
};

export const btn = (variant: Variant = "primary", extra?: string) =>
  cx(
    "inline-flex items-center justify-center gap-2 rounded-lg border px-3.5 py-2",
    "text-sm font-medium transition-colors",
    "disabled:pointer-events-none disabled:opacity-50",
    VARIANTS[variant],
    extra,
  );

/* ------------------------------------------------------------------ cards */

export function Card({
  children,
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "li" | "article";
}) {
  return (
    <Tag className={cx("rounded-card border border-line bg-surface", className)}>
      {children}
    </Tag>
  );
}

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
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

/* ----------------------------------------------------------------- badges */

export type Tone = "neutral" | "positive" | "warning" | "danger" | "info" | "accent";

const TONES: Record<Tone, string> = {
  neutral: "bg-surface-2 text-muted",
  positive: "bg-positive-soft text-positive",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
  accent: "bg-accent-soft text-accent",
};

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ------------------------------------------------------------- form bits */

export const inputClass = cx(
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink",
  "placeholder:text-faint focus:border-accent focus:outline-none",
);

export function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

/* ----------------------------------------------------------------- notices */

export function Notice({
  tone = "info",
  title,
  children,
}: {
  tone?: Tone;
  title?: string;
  children: ReactNode;
}) {
  return (
    <div className={cx("rounded-lg px-4 py-3 text-sm", TONES[tone])} role="status">
      {title ? <p className="font-semibold">{title}</p> : null}
      <div className={cx(title && "mt-0.5", "leading-relaxed")}>{children}</div>
    </div>
  );
}

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
    <div className="rounded-card border border-dashed border-line-strong px-6 py-12 text-center">
      <p className="text-sm font-medium text-ink">{title}</p>
      {description ? <p className="mx-auto mt-1 max-w-md text-sm text-muted">{description}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

/* ------------------------------------------------------------ misc display */

/**
 * Catalog images are optional. When a product has none, fall back to initials on a
 * deterministic tint so the grid stays visually even instead of showing gaps.
 */
export function ProductThumb({
  name,
  imageUrl,
  contain = false,
}: {
  name: string;
  imageUrl: string | null;
  /** Show the whole image on white (drawings) instead of cropping to fill (photos). */
  contain?: boolean;
}) {
  if (imageUrl) {
    return (
      // Not next/image: these URLs are admin-entered and can point at any host, and
      // allowlisting arbitrary remote hosts in the optimizer is worse than skipping it.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt=""
        className={contain ? "h-full w-full bg-white object-contain p-2" : "h-full w-full object-cover"}
        loading="lazy"
        decoding="async"
      />
    );
  }

  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  // Hash the name to a hue so a given product always gets the same tile.
  const hue = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);

  return (
    <div
      aria-hidden
      className="flex h-full w-full items-center justify-center text-xl font-semibold"
      style={{
        background: `linear-gradient(135deg, oklch(0.82 0.07 ${hue}), oklch(0.72 0.1 ${(hue + 40) % 360}))`,
        color: "oklch(0.28 0.06 " + hue + ")",
      }}
    >
      {initials}
    </div>
  );
}

export function DescriptionRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium text-ink">{children}</dd>
    </div>
  );
}

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
