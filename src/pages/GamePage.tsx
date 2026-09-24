import { BackButton } from "../components/BackButton";
import { Board } from "../components/Board";
import { MatchToast } from "../components/MatchToast";
import { ScoreChip } from "../components/ScoreChip";
import type { PageSlots } from "../components/BasePage";
import { boardLayoutFor } from "../lib/constants";
import { otherPlayer, type GameState, type Player } from "../lib/game";
import { playerLabel } from "../lib/playerLabel";

interface Props {
  game: GameState;
  localPlayer: Player | null; // オンライン対戦での自分(ひとりで遊ぶではnull)
  toast: string | null;
  onFlip: (index: number) => void;
  onHome: () => void;
}

export function GamePage({ game, localPlayer, toast, onFlip, onHome }: Props): PageSlots {
  const myTurn = localPlayer === null || game.turnPlayer === localPlayer;
  return {
    header: <BackButton onClick={onHome} />,
    center: <Board game={game} canInteract={myTurn} onFlip={onFlip} />,
    bottom:
      localPlayer !== null ? (
        // オンライン対戦: 左に自分、右に相手の取ったカードの枚数。真ん中に手番
        <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2 px-3">
          <div className="flex justify-start">
            <ScoreChip player={localPlayer} label="あなた" cards={game.scores[localPlayer] * 2} active={myTurn} />
          </div>
          <div className="text-outline text-center font-heading text-lg font-bold whitespace-nowrap text-white">
            {playerLabel(game.turnPlayer, localPlayer)}の番！
          </div>
          <div className="flex justify-end">
            <ScoreChip player={otherPlayer(localPlayer)} label="あいて" cards={game.scores[otherPlayer(localPlayer)] * 2} active={!myTurn} />
          </div>
        </div>
      ) : (
        <div className="text-outline text-center font-heading text-base font-bold text-white">
          おなじひなこを 2まい そろえよう
        </div>
      ),
    overlay: <MatchToast message={toast} />,
    compact: boardLayoutFor(game.cards.length).compact,
  };
}
