// オンライン対戦(ホスト権威モデル)で端末間をやり取りするメッセージの型定義と、GameStateとの相互変換。
// Firebaseの詳細はroomSync.ts側に閉じ込め、フック側はここの型だけを意識すればよいようにする。
//
// Realtime Databaseは空配列やnullを保存せず(読み戻すとキーごと消えている)、
// 1,2のような連番の数字キーのオブジェクトは配列に変えてしまう。
// そのためGameStateをそのまま送らず、消えても困らない形(WireGame)に変換してから送る。

import { CARD_IMAGE_FILES } from "../cardCatalog";
import type { Card, GameState, Player } from "../game";

export type RoomRole = "host" | "guest";

export interface WireCard {
  file: string;
  owner: 0 | Player; // そろえたプレイヤー。未成立は0
}

export interface WireGame {
  cards: WireCard[];
  revealed?: number[]; // 空配列は保存されないので省略可
  turnPlayer: Player;
  p1Score: number;
  p2Score: number;
  moves: number;
  lastMatchIndex: number; // 直前にそろったカードの位置。無ければ-1
}

// ホスト→ゲスト: 現在の盤面。ゲストはこれをそのまま表示するだけで、ルールの判定はホストだけが行う。
export interface Snapshot {
  seq: number;
  gameId: number; // 「もう一度」で新しいゲームが始まるたびに変わる
  game: WireGame;
}

// ゲスト→ホスト: 自分の手番にめくったカード、決着後の「もう一度」
export type RemoteInputPayload = { type: "flip"; index: number } | { type: "restart" };

export type RoomErrorReason =
  | "full" // 同じ合言葉で既に2人が揃っている
  | "unknown";

export class RoomError extends Error {
  readonly reason: RoomErrorReason;

  constructor(reason: RoomErrorReason, message: string) {
    super(message);
    this.name = "RoomError";
    this.reason = reason;
  }
}

export function toWireGame(state: GameState): WireGame {
  const lastMatch = state.lastMatch;
  return {
    cards: state.cards.map((c) => ({ file: c.file, owner: c.matchedBy ?? 0 })),
    revealed: state.revealed,
    turnPlayer: state.turnPlayer,
    p1Score: state.scores[1],
    p2Score: state.scores[2],
    moves: state.moves,
    lastMatchIndex: lastMatch ? state.cards.findIndex((c) => c.id === lastMatch.id) : -1,
  };
}

const NAME_BY_FILE = new Map(CARD_IMAGE_FILES.map((def) => [def.file, def.name]));

// オンライン対戦のゲームとして戻す(ホスト=プレイヤー1、ゲスト=プレイヤー2)
export function fromWireGame(wire: WireGame): GameState {
  const cards: Card[] = wire.cards.map((c, id) => ({
    id,
    pairKey: c.file,
    file: c.file,
    name: NAME_BY_FILE.get(c.file) ?? "",
    matchedBy: c.owner === 0 ? null : c.owner,
  }));
  return {
    mode: "online",
    cards,
    revealed: wire.revealed ?? [],
    turnPlayer: wire.turnPlayer,
    scores: { 1: wire.p1Score, 2: wire.p2Score },
    moves: wire.moves,
    lastMatch: cards[wire.lastMatchIndex] ?? null,
  };
}
