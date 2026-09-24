import type { Player } from "./game";

// 対戦画面に出すプレイヤー名。自分から見て「あなた」「あいて」
export function playerLabel(player: Player, localPlayer: Player): string {
  return player === localPlayer ? "あなた" : "あいて";
}
