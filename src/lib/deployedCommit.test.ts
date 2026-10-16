import { describe, expect, it } from "vitest";
import { deployedCommit } from "./deployedCommit";

describe("deployedCommit", () => {
  it("prefers the self-hosted BUILD_COMMIT, then Vercel's, else null", () => {
    expect(deployedCommit({ BUILD_COMMIT: "abc", VERCEL_GIT_COMMIT_SHA: "def" })).toBe("abc");
    expect(deployedCommit({ VERCEL_GIT_COMMIT_SHA: "def" })).toBe("def");
    expect(deployedCommit({ BUILD_COMMIT: "" })).toBeNull();
    expect(deployedCommit({})).toBeNull();
  });
});
