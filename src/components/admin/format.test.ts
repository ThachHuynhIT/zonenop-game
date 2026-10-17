import { describe, expect, it } from "vitest";
import { compact, formatDateTime, formatDay, formatDayLong, formatNumber, gameEmoji, gameName, pageCount, share, sparkPath } from "./format";

describe("formatNumber", () => {
  it("groups thousands the Vietnamese way", () => {
    expect(formatNumber(12345)).toBe("12.345");
    expect(formatNumber(0)).toBe("0");
  });
  it("treats NaN as 0", () => {
    expect(formatNumber(Number.NaN)).toBe("0");
  });
});

describe("compact", () => {
  it("shortens thousands and millions", () => {
    expect(compact(999)).toBe("999");
    expect(compact(12345)).toBe("12,3 N");
    expect(compact(1234567)).toBe("1,2 Tr");
  });
});

describe("formatDay", () => {
  it("prints day/month", () => {
    expect(formatDay("2026-10-16")).toBe("16/10");
    expect(formatDay("2026-01-05")).toBe("05/01");
  });
  it("leaves anything else alone", () => {
    expect(formatDay("hôm qua")).toBe("hôm qua");
  });
});

describe("formatDayLong", () => {
  it("adds the weekday without shifting the day", () => {
    expect(formatDayLong("2026-10-16")).toBe("Thứ sáu, 16/10/2026");
    expect(formatDayLong("2026-10-18")).toBe("Chủ nhật, 18/10/2026");
  });
});

describe("formatDateTime", () => {
  it("shows Vietnam time", () => {
    expect(formatDateTime("2026-10-16T07:05:00Z")).toBe("16/10/2026 14:05");
    expect(formatDateTime("2026-10-16T20:30:00.000Z")).toBe("17/10/2026 03:30");
  });
  it("prints a dash for missing or invalid times", () => {
    expect(formatDateTime(null)).toBe("—");
    expect(formatDateTime("nope")).toBe("—");
  });
});

describe("gameName / gameEmoji", () => {
  it("uses the games list", () => {
    expect(gameName("tienlen")).toBe("Tiến Lên");
    expect(gameEmoji("meono")).toBe("😼");
  });
  it("falls back for unknown games", () => {
    expect(gameName("caro")).toBe("caro");
    expect(gameEmoji("caro")).toBe("🎲");
  });
});

describe("share", () => {
  it("scales against the largest value", () => {
    expect(share(50, 200)).toBe(25);
    expect(share(200, 200)).toBe(100);
    expect(share(1, 3)).toBe(33.3);
  });
  it("is 0 for empty data", () => {
    expect(share(0, 0)).toBe(0);
    expect(share(5, 0)).toBe(0);
  });
});

describe("pageCount", () => {
  it("rounds up and never goes below 1", () => {
    expect(pageCount(0, 50)).toBe(1);
    expect(pageCount(50, 50)).toBe(1);
    expect(pageCount(51, 50)).toBe(2);
  });
});

describe("sparkPath", () => {
  it("spans the box", () => {
    expect(sparkPath([0, 5, 10], 100, 20)).toBe("M0 20 L50 10 L100 0");
  });
  it("draws a flat series in the middle", () => {
    expect(sparkPath([3, 3], 10, 20)).toBe("M0 10 L10 10");
  });
  it("is empty without data", () => {
    expect(sparkPath([], 10, 10)).toBe("");
  });
});
