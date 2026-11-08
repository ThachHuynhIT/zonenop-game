import { describe, expect, it } from "vitest";
import { DEFAULT_USERS_QUERY, changeUsersQuery, usersQueryPath, validUsersPage } from "./usersQuery";

const params = (path: string) => Object.fromEntries(new URL(path, "http://x").searchParams);

describe("usersQueryPath", () => {
  it("builds the admin list path with every default", () => {
    const path = usersQueryPath(DEFAULT_USERS_QUERY);
    expect(path.startsWith("/api/admin/users?")).toBe(true);
    expect(params(path)).toEqual({ q: "", page: "1", filter: "all", sort: "createdAt", order: "desc" });
  });

  it("encodes the search safely, keeping Vietnamese text", () => {
    const path = usersQueryPath({ ...DEFAULT_USERS_QUERY, q: "Hoà & lan=1", page: 3, filter: "admin", sort: "games", order: "asc" });
    expect(path).not.toContain("& lan");
    expect(params(path)).toEqual({ q: "Hoà & lan=1", page: "3", filter: "admin", sort: "games", order: "asc" });
  });
});

describe("changeUsersQuery", () => {
  const at3 = { ...DEFAULT_USERS_QUERY, page: 3 };

  it("goes back to page 1 when any condition changes", () => {
    expect(changeUsersQuery(at3, { filter: "disabled" })).toEqual({ ...DEFAULT_USERS_QUERY, filter: "disabled", page: 1 });
    expect(changeUsersQuery(at3, { sort: "lastLoginAt" }).page).toBe(1);
    expect(changeUsersQuery(at3, { order: "asc" }).page).toBe(1);
    expect(changeUsersQuery(at3, { q: "lan" }).page).toBe(1);
  });

  it("keeps the page (and the same object) when nothing actually changes", () => {
    expect(changeUsersQuery(at3, { filter: "all", sort: "createdAt" })).toBe(at3);
    expect(changeUsersQuery(at3, {})).toBe(at3);
  });
});

describe("validUsersPage", () => {
  it("clamps to the pages that exist after a change emptied the last one", () => {
    expect(validUsersPage(0, 50, 3)).toBe(1);
    expect(validUsersPage(51, 50, 3)).toBe(2);
    expect(validUsersPage(120, 50, 2)).toBe(2);
    expect(validUsersPage(120, 50, 0)).toBe(1);
  });
});
