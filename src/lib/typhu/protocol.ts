/**
 * Client-side copy of the be_game Cờ Tỷ Phú protocol (github.com/ThachHuynhIT/be_game,
 * src/typhu/protocol.ts + the shared types from src/typhu/game.ts). Keep them in sync.
 */
import type { ChatMessage, GameRecord, LeaderboardEntry, Reaction } from "@/lib/tienlen";
import type { MapSize } from "./board";

export type { ChatMessage, GameRecord, LeaderboardEntry, Reaction, MapSize };

export type Phase = "roll" | "buy" | "debt" | "end";

export interface Deed {
  owner: string;
  /** 0–4 houses, 5 = khách sạn. */
  houses: number;
  mortgaged: boolean;
}

export interface TradeSide {
  props: number[];
  cash: number;
}

/** A request to borrow `amount` from `to`, repaid + rate% after LOAN_TURNS of the borrower's turns. */
export interface LoanOffer {
  from: string;
  to: string;
  amount: number;
  rate: number;
  deadline: number;
}
export interface Loan {
  id: number;
  lender: string;
  borrower: string;
  amount: number;
  rate: number;
  owed: number;
  left: number;
}
export const LOAN_TURNS = 5;
export const LOAN_RATES = [10, 20];

export interface LogEntry {
  id: number;
  at: number;
  text: string;
  tone?: "money" | "bad" | "jail" | "card" | "info" | "buy";
}

/** WebSocket endpoint for Cờ Tỷ Phú. */
export const TYPHU_WS_PATH = "/api/typhu/ws";

export interface TPSettings {
  startCash: number;
  /** Minutes, 0 = no limit. */
  timeLimit: number;
  /** Seconds per step (missing from older servers). */
  stepSeconds?: number;
  /** Landing exactly on Khởi hành pays double. */
  doubleGo?: boolean;
  /** Taxes and fines pile up on Nghỉ chân. */
  parkingPot?: boolean;
  /** Map size (missing from older servers = the standard 40 squares). */
  map?: MapSize;
  first?: number;
  second?: number;
  /** House rules (missing from older servers = classic). "even": build evenly; "chain": see TyPhuRules. */
  buildRule?: "even" | "chain";
  /** Own the whole colour group before building. */
  needGroup?: boolean;
  /** Sell land back to the bank (for landSalePct of its price). */
  sellLand?: boolean;
  /** A bankrupt player's land: back on the market ("bank") or to the creditor. */
  bankruptTo?: "bank" | "creditor";
  /** Price / turn knobs (missing from older servers = the defaults in board.ts / TyPhuTable). */
  goSalary?: number;
  risingCost?: boolean;
  unmortgageFee?: number;
  landSalePct?: number;
  jailRent?: boolean;
  doubleRoll?: boolean;
}

export const STEP_SECONDS_OPTIONS = [15, 20, 30, 45, 60];

/** A player's token: the emoji that walks the board and the colour of their houses / deeds. */
export interface TPPiece {
  emoji: string;
  color: string;
}
/** What a player may pick with `{ type: "pick", emoji, color }` — nobody else at the table may hold the same emoji or colour. */
export const PIECE_EMOJIS = ["🛵", "🐃", "🚲", "🚤", "🐉", "🎩", "🚗", "🐘", "🦅", "🐅", "🚁", "🐒", "🐱", "🐈", "🐈‍⬛", "😺", "😻", "😼", "🙀", "🦁", "🐆"];
export const PIECE_COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#eab308", "#a855f7", "#f97316", "#06b6d4", "#ec4899"];

export interface TPSeatView {
  id: string;
  name: string;
  connected: boolean;
  isHost: boolean;
  inGame: boolean;
  kicked: boolean;
  points: number;
  games: number;
  wins: number;
  /** Token colour index (stable per seat). */
  color: number;
  /** The piece this player plays with (their pick, else a starting piece nobody else holds). */
  piece: TPPiece;
}

export interface TPPlayerView {
  id: string;
  pos: number;
  cash: number;
  jail: number;
  jailCards: number;
  bankrupt: boolean;
  netWorth: number;
}

export interface TPGameView {
  status: "playing" | "ended";
  /** Map this game is played on (missing = standard). */
  map?: MapSize;
  players: TPPlayerView[];
  deeds: Record<number, Deed>;
  turn: string | null;
  phase: Phase;
  deadline: number | null;
  dice: [number, number] | null;
  rollAgain: boolean;
  debt: { amount: number; to: string | null; reason: string } | null;
  trade: { from: string; to: string; give: TradeSide; get: TradeSide; deadline: number } | null;
  lastCard: { deck: "chance" | "chest"; text: string; player: string; at: number } | null;
  finished: string[];
  endsAt: number | null;
  /** Nghỉ chân pot (null when the rule is off). */
  pot?: number | null;
  /** Pending request to borrow money, and the loans in force. */
  loan?: LoanOffer | null;
  loans?: Loan[];
  log: LogEntry[];
  /** My own lots: why build / sell a house / sell the land is blocked (null = allowed), and the land's sale price. */
  manage?: Record<number, { build: string | null; sell: string | null; sellLand: string | null; landPrice: number }>;
}

export interface TPRoomView {
  game: "typhu";
  code: string;
  meId: string;
  role: "player" | "spectator";
  /** Only in your own view: your auto-play (Ctrl+Shift+Y) is on and the server plays your turns. */
  auto?: boolean;
  serverTime: number;
  settings: TPSettings;
  seats: (TPSeatView | null)[];
  current: TPGameView | null;
  history: GameRecord[];
  spectators: string[];
  reactions: Reaction[];
  chat?: ChatMessage[];
}

export interface TPRoomSummary {
  code: string;
  status: "waiting" | "playing";
  players: { name: string; connected: boolean; points: number }[];
  spectators: number;
  games: number;
}

/**
 * Cờ Tỷ Phú commands (acked like the other games):
 *   { type: "start" } · { type: "settings", startCash, timeLimit } · { type: "kick", playerId }
 *   { type: "roll" } · { type: "buy" } · { type: "skip" } · { type: "end" }
 *   { type: "payjail" } · { type: "jailcard" } · { type: "paydebt" } · { type: "bankrupt" }
 *   { type: "build" | "sell" | "mortgage" | "unmortgage", pos }
 *   { type: "trade", to, give: {props, cash}, get: {props, cash} }
 *   { type: "loan", to, amount, rate: 10 | 20 } · { type: "loananswer", accept }
 *   { type: "tradeanswer", accept }   // the receiver answers; the proposer can withdraw with accept: false
 *   { type: "auto", on }   // your own auto-play: the server plays your turns (buys squares under 300tr, never builds), keeping 150tr
 */
export type TPCommand =
  | { type: "start" }
  | { type: "settings"; startCash?: number; timeLimit?: number; stepSeconds?: number; doubleGo?: boolean; parkingPot?: boolean; map?: MapSize; first?: number; second?: number }
  | { type: "pick"; emoji: string; color: string }
  | { type: "kick"; playerId: string }
  | { type: "roll" | "buy" | "skip" | "end" | "payjail" | "jailcard" | "paydebt" | "bankrupt" }
  | { type: "build" | "sell" | "sellland" | "mortgage" | "unmortgage"; pos: number }
  | { type: "trade"; to: string; give: TradeSide; get: TradeSide }
  | { type: "loan"; to: string; amount: number; rate: number }
  | { type: "loananswer"; accept: boolean }
  | { type: "tradeanswer"; accept: boolean }
  | { type: "auto"; on: boolean };
