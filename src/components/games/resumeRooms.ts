import { ONLINE_GAMES, type GameId } from "./gamesRegistry";

/** Ignore game ids that this client does not know yet. */
export function resumeRooms(rooms: readonly { game: string; code: string }[], onlyGame?: GameId) {
  return rooms.flatMap((room) => {
    const game = ONLINE_GAMES.find((entry) => entry.id === room.game);
    if (!game || (onlyGame && game.id !== onlyGame)) return [];
    return [{ game, code: room.code, href: `${game.href}/${room.code}` }];
  });
}
