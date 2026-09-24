// 神経衰弱のルール本体。Reactに依存しない純粋な関数だけで組み立て、
// 状態は毎回新しいオブジェクトとして返す(テストしやすく、Reactのstateにもそのまま載せられる)。
// 「そろわなかった2枚を少し見せてから裏に戻す」待ち時間の管理だけはフック側(useMemoryGame)が受け持つ。

import type { CardImageDef } from "./cardCatalog";

export type Player = 1 | 2;
export type GameMode = "solo" | "online"; // ひとりで遊ぶ / オンラインで対戦

export interface Card {
  id: number; // 盤面上の位置に関係なく一意
  pairKey: string; // 同じ絵柄の2枚で共通(画像ファイル名)
  name: string;
  file: string;
  matchedBy: Player | null; // そろえたプレイヤー(ひとりで遊ぶでは常に1)。未成立ならnull
}

export interface GameState {
  mode: GameMode;
  cards: Card[];
  revealed: number[]; // 表になっている未成立のカードの位置(0〜2枚)
  turnPlayer: Player;
  scores: Record<Player, number>; // そろえたペア数
  moves: number; // 2枚めくった回数
  lastMatch: Card | null; // 直前にそろったカード(演出用)
}

export type Rng = () => number;

export function otherPlayer(player: Player): Player {
  return player === 1 ? 2 : 1;
}

// Fisher–Yates。元の配列は変更しない
export function shuffle<T>(items: readonly T[], rng: Rng = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function createGame(
  mode: GameMode,
  catalog: readonly CardImageDef[],
  pairCount: number,
  rng: Rng = Math.random,
): GameState {
  if (catalog.length < pairCount) {
    throw new Error(`画像が足りません(${pairCount}種類必要ですが${catalog.length}種類しかありません)`);
  }
  const picked = shuffle(catalog, rng).slice(0, pairCount);
  const cards = shuffle(
    picked.flatMap((def) => [def, def]),
    rng,
  ).map((def, id) => ({ id, pairKey: def.file, name: def.name, file: def.file, matchedBy: null }));
  return {
    mode,
    cards,
    revealed: [],
    turnPlayer: 1,
    scores: { 1: 0, 2: 0 },
    moves: 0,
    lastMatch: null,
  };
}

// そろわなかった2枚が表のまま残っていて、裏に戻すのを待っている状態
export function isWaitingFlipBack(state: GameState): boolean {
  return state.revealed.length === 2;
}

export function isFinished(state: GameState): boolean {
  return state.cards.every((c) => c.matchedBy !== null);
}

export function canFlip(state: GameState, index: number): boolean {
  const card = state.cards[index];
  return (
    card !== undefined &&
    card.matchedBy === null &&
    !state.revealed.includes(index) &&
    !isWaitingFlipBack(state) &&
    !isFinished(state)
  );
}

// 1枚めくる。2枚目でそろえばその場で確定し、同じプレイヤーがもう一度めくれる。
// そろわなければ2枚とも表のまま返すので、呼び出し側が少し待ってから flipBack を呼ぶ。
export function flipCard(state: GameState, index: number): GameState {
  if (!canFlip(state, index)) return state;
  const revealed = [...state.revealed, index];
  if (revealed.length < 2) return { ...state, revealed };

  const moves = state.moves + 1;
  const [a, b] = revealed;
  if (state.cards[a].pairKey !== state.cards[b].pairKey) {
    return { ...state, revealed, moves };
  }
  const player = state.turnPlayer;
  const cards = state.cards.map((c, i) => (i === a || i === b ? { ...c, matchedBy: player } : c));
  return {
    ...state,
    cards,
    revealed: [],
    moves,
    scores: { ...state.scores, [player]: state.scores[player] + 1 },
    lastMatch: cards[a],
  };
}

// そろわなかった2枚を裏に戻し、対戦なら手番を交代する
export function flipBack(state: GameState): GameState {
  if (!isWaitingFlipBack(state)) return state;
  const turnPlayer: Player = state.mode === "online" ? otherPlayer(state.turnPlayer) : state.turnPlayer;
  return { ...state, revealed: [], turnPlayer };
}

// 対戦の勝者。引き分けはnull
export function winnerOf(state: GameState): Player | null {
  if (state.scores[1] === state.scores[2]) return null;
  return state.scores[1] > state.scores[2] ? 1 : 2;
}
