import { describe, expect, it } from "vitest";
import { resumeRooms } from "./resumeRooms";

describe("resumeRooms", () => {
  const rooms = [{ game: "tienlen", code: "ABCD" }, { game: "meono", code: "EFGH" }, { game: "unknown", code: "IJKL" }];
  it("maps known games to their registry routes and labels", () => {
    expect(resumeRooms(rooms).map((room) => [room.game.title, room.href])).toEqual([
      ["Tiến Lên Miền Nam", "/tien-len/ABCD"], ["Mèo Nổ", "/meo-no/EFGH"],
    ]);
  });
  it("filters the lobby to its own game", () => {
    expect(resumeRooms(rooms, "meono").map((room) => room.code)).toEqual(["EFGH"]);
  });
  it("returns no entries for an empty list", () => {
    expect(resumeRooms([])).toEqual([]);
  });
});
