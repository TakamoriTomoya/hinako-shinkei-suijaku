import { describe, expect, it } from "vitest";
import { CARD_IMAGE_FILES } from "../cardCatalog";
import { createGame, flipCard } from "../game";
import { fromWireGame, toWireGame, type WireGame } from "./types";

// Realtime Databaseに保存して読み戻した時と同じく、空配列・nullのキーを消す
function roundTripLikeRtdb(wire: WireGame): WireGame {
  return JSON.parse(JSON.stringify(wire, (_k, v: unknown) => (Array.isArray(v) && v.length === 0 ? undefined : v)));
}

describe("toWireGame / fromWireGame", () => {
  it("保存して読み戻しても同じ盤面になる", () => {
    let game = createGame("online", CARD_IMAGE_FILES, 8);
    const pair = game.cards.findIndex((c, i) => i > 0 && c.pairKey === game.cards[0].pairKey);
    game = flipCard(flipCard(game, 0), pair);
    const restored = fromWireGame(roundTripLikeRtdb(toWireGame(game)));
    expect(restored).toEqual(game);
    expect(restored.revealed).toEqual([]);
    expect(restored.lastMatch?.name).toBe(game.cards[0].name);
  });

  it("始めたばかりの盤面(めくったカード無し・直前のそろい無し)も戻せる", () => {
    const game = createGame("online", CARD_IMAGE_FILES, 8);
    expect(fromWireGame(roundTripLikeRtdb(toWireGame(game)))).toEqual(game);
  });
});
