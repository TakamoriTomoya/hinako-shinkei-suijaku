import { describe, expect, it } from "vitest";
import { canFlip, createGame, flipBack, flipCard, isFinished, winnerOf, type GameState } from "./game";

const catalog = [
  { file: "a.png", name: "a" },
  { file: "b.png", name: "b" },
  { file: "c.png", name: "c" },
];

// 決まった並びで試せるよう、シャッフルしない乱数(常に末尾と入れ替え=そのまま)
const identity = () => 0.9999;

// a,a,b,b の順に並んだ2ペアのゲーム
function fixedGame(mode: "solo" | "online" = "online"): GameState {
  const game = createGame(mode, catalog.slice(0, 2), 2, identity);
  expect(game.cards.map((c) => c.pairKey)).toEqual(["a.png", "a.png", "b.png", "b.png"]);
  return game;
}

describe("createGame", () => {
  it("選んだ種類を2枚ずつ並べる", () => {
    const game = createGame("solo", catalog, 3);
    expect(game.cards).toHaveLength(6);
    const counts = new Map<string, number>();
    game.cards.forEach((c) => counts.set(c.pairKey, (counts.get(c.pairKey) ?? 0) + 1));
    expect([...counts.values()]).toEqual([2, 2, 2]);
    expect(new Set(game.cards.map((c) => c.id)).size).toBe(6);
  });

  it("画像が足りなければエラー", () => {
    expect(() => createGame("solo", catalog, 4)).toThrow();
  });
});

describe("flipCard", () => {
  it("そろえば得点し、同じプレイヤーが続ける", () => {
    let game = fixedGame();
    game = flipCard(game, 0);
    game = flipCard(game, 1);
    expect(game.scores).toEqual({ 1: 1, 2: 0 });
    expect(game.turnPlayer).toBe(1);
    expect(game.revealed).toEqual([]);
    expect(game.cards[0].matchedBy).toBe(1);
    expect(game.lastMatch?.pairKey).toBe("a.png");
    expect(game.moves).toBe(1);
  });

  it("そろわなければ2枚表のまま、裏に戻すと手番が交代する", () => {
    let game = fixedGame();
    game = flipCard(game, 0);
    game = flipCard(game, 2);
    expect(game.revealed).toEqual([0, 2]);
    // 裏に戻すまでは3枚目をめくれない
    expect(canFlip(game, 3)).toBe(false);
    expect(flipCard(game, 3)).toBe(game);
    game = flipBack(game);
    expect(game.revealed).toEqual([]);
    expect(game.turnPlayer).toBe(2);
  });

  it("ひとりで遊ぶでは手番が変わらない", () => {
    let game = fixedGame("solo");
    game = flipBack(flipCard(flipCard(game, 0), 2));
    expect(game.turnPlayer).toBe(1);
    expect(game.moves).toBe(1);
  });

  it("同じカードや成立済みのカードはめくれない", () => {
    let game = fixedGame();
    game = flipCard(game, 0);
    expect(flipCard(game, 0)).toBe(game);
    game = flipCard(game, 1);
    expect(flipCard(game, 0)).toBe(game);
  });

  it("全部そろえば終わり、多くそろえた方が勝ち", () => {
    let game = fixedGame();
    game = flipBack(flipCard(flipCard(game, 0), 2)); // P1ミス
    game = flipCard(flipCard(game, 2), 3); // P2そろえる
    expect(winnerOf(game)).toBe(2);
    expect(isFinished(game)).toBe(false);
    game = flipCard(flipCard(game, 0), 1); // P2そろえる
    expect(isFinished(game)).toBe(true);
    expect(game.scores).toEqual({ 1: 0, 2: 2 });
    expect(winnerOf(game)).toBe(2);
  });
});
