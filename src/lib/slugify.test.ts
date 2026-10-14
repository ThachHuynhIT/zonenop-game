import { describe, expect, it } from "vitest";
import { slugify } from "./slugify";
// Same shape the old admin slug field validated: lowercase words joined by single hyphens.
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

describe("slugify", () => {
  const nonEmptyCases = [
    "My Cool Project",
    "  Hello   World!!  ",
    "Cafe Deja Vu",
    "Already-Has-Hyphens",
    "123 Numbers",
    "Snake_Case_Input",
    "Multiple---Hyphens...Dots",
  ];

  it.each(nonEmptyCases)("output for %s always matches slugPattern", (input) => {
    expect(slugify(input)).toMatch(slugPattern);
  });

  it("lowercases and hyphenates spaces", () => {
    expect(slugify("My Cool Project")).toBe("my-cool-project");
  });

  it("collapses punctuation and repeated separators into one hyphen", () => {
    expect(slugify("  Hello   World!!  ")).toBe("hello-world");
    expect(slugify("Multiple---Hyphens...Dots")).toBe("multiple-hyphens-dots");
  });

  it("strips accents via NFKD decomposition", () => {
    expect(slugify("Café Déjà Vu")).toBe("cafe-deja-vu");
  });

  it("returns an empty string for input with no alphanumeric characters", () => {
    expect(slugify("!!!")).toBe("");
    expect(slugify("")).toBe("");
  });
});
