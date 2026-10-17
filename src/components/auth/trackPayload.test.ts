import { describe, expect, it } from "vitest";
import { trackPayload } from "./trackPayload";

describe("trackPayload", () => {
  it("keeps plain paths", () => {
    expect(trackPayload("/tien-len/ABCD")).toBe("/tien-len/ABCD");
  });
  it("strips query and hash", () => {
    expect(trackPayload("/bang?x=1#top")).toBe("/bang");
    expect(trackPayload("/bang#a?b")).toBe("/bang");
  });
  it("caps at 200 characters", () => {
    expect(trackPayload("/" + "a".repeat(500))).toHaveLength(200);
  });
  it("falls back to root when empty", () => {
    expect(trackPayload("")).toBe("/");
    expect(trackPayload("?x=1")).toBe("/");
  });
});
