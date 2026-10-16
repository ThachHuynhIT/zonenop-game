import { describe, expect, it } from "vitest";
import { usernameProblem } from "./username";

describe("usernameProblem", () => {
  it("accepts letters, digits, _ . and single spaces", () => {
    expect(usernameProblem("Nguyễn Văn_A.1")).toBeNull();
    expect(usernameProblem("  abc  ")).toBeNull();
  });
  it("rejects bad length, double spaces and symbols", () => {
    expect(usernameProblem("ab")).not.toBeNull();
    expect(usernameProblem("a".repeat(21))).not.toBeNull();
    expect(usernameProblem("a  b")).not.toBeNull();
    expect(usernameProblem("a-b!")).not.toBeNull();
    expect(usernameProblem("😼😼😼")).not.toBeNull();
  });
});
