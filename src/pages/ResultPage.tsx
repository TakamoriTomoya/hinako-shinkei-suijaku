import { BackButton } from "../components/BackButton";
import { Board } from "../components/Board";
import { GameOverControls } from "../components/GameOverControls";
import type { PageSlots } from "../components/BasePage";
import { boardLayoutFor } from "../lib/constants";
import { otherPlayer, winnerOf, type GameState, type Player } from "../lib/game";

interface Props {
  game: GameState;
  localPlayer: Player | null; // オンライン対戦での自分(ひとりで遊ぶではnull)
  onHome: () => void;
  onRestart: () => void;
}

const noop = () => {};

// オンライン対戦は自分から見た勝ち負けを出す
function resultTitle(game: GameState, localPlayer: Player | null): string {
  if (game.mode === "solo" || localPlayer === null) return "クリア！";
  const winner = winnerOf(game);
  if (winner === null) return "ひきわけ！";
  return winner === localPlayer ? "あなたの勝ち！" : "あなたの負け…";
}

// オンライン対戦の取ったカードの枚数を「あなた - あいて」の順に出す(遊んでいる時のフッターと同じ数え方)
function scoreText(game: GameState, localPlayer: Player): string {
  return `${game.scores[localPlayer] * 2}まい - ${game.scores[otherPlayer(localPlayer)] * 2}まい`;
}

// そろえ終わった盤面を背景に残したまま、結果を重ねて出す
export function ResultPage({ game, localPlayer, onHome, onRestart }: Props): PageSlots {
  return {
    header: <BackButton onClick={onHome} />,
    center: (
      <div className="opacity-50" inert>
        <Board game={game} canInteract={false} onFlip={noop} />
      </div>
    ),
    bottom: <GameOverControls onRestart={onRestart} />,
    // 盤面の大きさが変わらないよう、遊んでいた時と同じ帯の太さにする
    compact: boardLayoutFor(game.cards.length).compact,
    overlay: (
      <div className="pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2 flex-col items-center gap-3 px-4 text-center">
        <p className="toast-pop text-outline font-heading text-[40px] leading-[1.15] font-extrabold text-white">
          {resultTitle(game, localPlayer)}
        </p>
        {localPlayer !== null && (
          <p className="rounded-full bg-bg-cream/95 px-5 py-2 font-heading text-lg font-bold text-text-dark shadow-[0_4px_0_rgba(0,0,0,0.08)]">
            {scoreText(game, localPlayer)}
          </p>
        )}
      </div>
    ),
  };
}
