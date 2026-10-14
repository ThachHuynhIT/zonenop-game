import { describe, expect, it } from "vitest";
import { formatDate, formatDuration, formatYearRange } from "./format-date";

describe("formatDate", () => {
  it("formats a Date in en-US, UTC", () => {
    expect(formatDate(new Date("2026-03-05T00:00:00Z"))).toBe("March 5, 2026");
  });

  it("formats an ISO date string the same way", () => {
    expect(formatDate("2026-03-05T00:00:00Z")).toBe("March 5, 2026");
  });

  it("doesn't roll over to the previous day for a UTC midnight timestamp", () => {
    // The exact bug a locale-default (non-UTC) formatter would introduce on
    // a server running in a negative-offset timezone.
    expect(formatDate(new Date("2026-01-01T00:00:00Z"))).toBe(
      "January 1, 2026",
    );
  });
});

describe("formatYearRange", () => {
  it("formats a closed range as year — year", () => {
    expect(
      formatYearRange(
        new Date("2020-06-15T00:00:00Z"),
        new Date("2023-09-01T00:00:00Z"),
      ),
    ).toBe("2020 — 2023");
  });

  it("collapses to a single year when start and end share a year", () => {
    expect(
      formatYearRange(
        new Date("2023-02-01T00:00:00Z"),
        new Date("2023-11-01T00:00:00Z"),
      ),
    ).toBe("2023");
  });

  it("formats a null end as an ongoing range", () => {
    expect(formatYearRange(new Date("2024-01-10T00:00:00Z"), null)).toBe(
      "2024 — now",
    );
  });
});

describe("formatDuration", () => {
  it("formats a multi-year span with a month remainder", () => {
    expect(
      formatDuration(
        new Date("2020-06-15T00:00:00Z"),
        new Date("2023-09-01T00:00:00Z"),
      ),
    ).toBe("3y 3m");
  });

  it("formats a whole-year span with no month remainder", () => {
    expect(
      formatDuration(
        new Date("2021-01-01T00:00:00Z"),
        new Date("2023-01-01T00:00:00Z"),
      ),
    ).toBe("2y");
  });

  it("formats a sub-year span in months only", () => {
    expect(
      formatDuration(
        new Date("2024-01-10T00:00:00Z"),
        new Date("2024-09-10T00:00:00Z"),
      ),
    ).toBe("8m");
  });

  it("accepts string dates for both ends", () => {
    expect(
      formatDuration("2020-06-15T00:00:00Z", "2023-09-01T00:00:00Z"),
    ).toBe("3y 3m");
  });
});
