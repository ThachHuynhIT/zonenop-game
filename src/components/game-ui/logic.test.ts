import { describe, expect, it } from "vitest";
import { CONFIRM_RESET_MS, URGENT_FRACTION, confirmStep, contrastRatio, countdownState } from "./logic";

describe("confirmStep", () => {
  it("arms on the first press without firing", () => {
    expect(confirmStep(false)).toEqual({ fire: false, armed: true });
  });
  it("fires and disarms on the second press", () => {
    expect(confirmStep(true)).toEqual({ fire: true, armed: false });
  });
  it("resets after 3.5 s", () => {
    expect(CONFIRM_RESET_MS).toBe(3500);
  });
});

describe("countdownState", () => {
  const T = 1_000_000;
  it("reports the remaining share of the turn", () => {
    expect(countdownState(T + 15_000, 30_000, T)).toEqual({ remainingMs: 15_000, fraction: 0.5, urgent: false });
  });
  it("is urgent from a quarter left", () => {
    expect(countdownState(T + 7_500, 30_000, T).urgent).toBe(true);
    expect(URGENT_FRACTION).toBe(0.25);
  });
  it("never goes below zero once the deadline passed", () => {
    expect(countdownState(T - 5_000, 30_000, T)).toEqual({ remainingMs: 0, fraction: 0, urgent: true });
  });
  it("caps the fraction at 1 when the deadline is further than the total", () => {
    expect(countdownState(T + 60_000, 30_000, T).fraction).toBe(1);
  });
  it("treats a zero total or a NaN deadline as expired", () => {
    expect(countdownState(T + 5_000, 0, T)).toEqual({ remainingMs: 5_000, fraction: 0, urgent: true });
    expect(countdownState(Number.NaN, 30_000, T)).toEqual({ remainingMs: 0, fraction: 0, urgent: true });
  });
});

describe("contrastRatio", () => {
  it("is 21 for black on white and symmetric", () => {
    expect(contrastRatio([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 5);
    expect(contrastRatio([255, 255, 255], [0, 0, 0])).toBeCloseTo(21, 5);
  });
  it("is 1 for identical colours", () => {
    expect(contrastRatio([120, 40, 200], [120, 40, 200])).toBe(1);
  });
  it("matches a known pair (#777 on white ≈ 4.48)", () => {
    expect(contrastRatio([119, 119, 119], [255, 255, 255])).toBeCloseTo(4.48, 2);
  });
});
