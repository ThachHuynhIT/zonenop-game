// Pinned to en-US + UTC so a rendered date can't drift between build time
// and request time on a server that isn't necessarily in the same locale/TZ
// as a reader's browser (Phase 10 §7).
const DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});

const YEAR_FORMATTER = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  timeZone: "UTC",
});

export function formatDate(date: Date | string): string {
  return DATE_FORMATTER.format(new Date(date));
}

// Year-only range for /cv's narrow mono date rail (Phase 16) — a full
// "March 2021 — Present" doesn't fit there. Collapses to a single year
// when start and end fall in the same year, since "2023 — 2023" reads as
// a typo rather than a fact on a document. `end: null` reads as an
// ongoing entry (e.g. a current job) rather than a missing one.
export function formatYearRange(
  start: Date | string,
  end: Date | string | null,
): string {
  const startLabel = YEAR_FORMATTER.format(new Date(start));
  if (!end) {
    return `${startLabel} — now`;
  }
  const endLabel = YEAR_FORMATTER.format(new Date(end));
  return startLabel === endLabel ? startLabel : `${startLabel} — ${endLabel}`;
}

function monthsBetween(start: Date, end: Date): number {
  return (
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (end.getUTCMonth() - start.getUTCMonth())
  );
}

// `end` is the caller's job to resolve for an ongoing entry (e.g.
// `entry.endDate ?? new Date()`) — keeping this function itself pure and
// deterministic keeps it fully testable without a hidden clock read.
// Calendar-month granularity, not exact days.
export function formatDuration(
  start: Date | string,
  end: Date | string,
): string {
  const totalMonths = Math.max(
    0,
    monthsBetween(new Date(start), new Date(end)),
  );
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;

  if (years === 0) return `${months}m`;
  if (months === 0) return `${years}y`;
  return `${years}y ${months}m`;
}
