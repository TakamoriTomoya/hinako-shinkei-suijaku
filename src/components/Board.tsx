import { boardLayoutFor, type BoardLayout } from "../lib/constants";
import { canFlip, type GameState } from "../lib/game";
import { useElementSize, type Size } from "../hooks/useElementSize";
import { useIsLandscape } from "../hooks/useIsLandscape";
import { MemoryCard } from "./MemoryCard";

interface Props {
  game: GameState;
  canInteract: boolean; // オンライン対戦で相手の手番の間などはfalse(カードを押せなくする)
  onFlip: (index: number) => void;
}

// 使える広さ(area)に columns × rows のカードを並べた時の、はみ出さない最大のカードの大きさ
function fitCardSize(area: Size, columns: number, rows: number, gap: number, layout: BoardLayout): Size {
  const maxW = (area.width - gap * (columns - 1)) / columns;
  const maxH = (area.height - gap * (rows - 1)) / rows;
  const width = Math.min(maxW, maxH * layout.cardAspect.max, layout.maxCardWidth);
  const height = Math.min(maxH, width / layout.cardAspect.min);
  return { width: Math.max(0, Math.floor(width)), height: Math.max(0, Math.floor(height)) };
}

// カードを並べる盤面。中心エリアの実際の広さを測り、その中に収まる最大の大きさでカードを並べる
export function Board({ game, canInteract, onFlip }: Props) {
  const [areaRef, area] = useElementSize<HTMLDivElement>();
  const isLandscape = useIsLandscape();
  const layout = boardLayoutFor(game.cards.length);
  const columns = isLandscape ? layout.columns.landscape : layout.columns.portrait;
  const rows = Math.ceil(game.cards.length / columns);
  const gap = rows > 4 ? 6 : 10;
  const card = area ? fitCardSize(area, columns, rows, gap, layout) : null;
  return (
    <div ref={areaRef} className="absolute inset-0 flex items-center justify-center px-3 pt-1 pb-5">
      {card && (
        <div
          className="pointer-events-auto grid"
          style={{ gridTemplateColumns: `repeat(${columns}, ${card.width}px)`, gap }}
        >
          {game.cards.map((c, index) => (
            <MemoryCard
              key={c.id}
              card={c}
              width={card.width}
              height={card.height}
              faceUp={c.matchedBy !== null || game.revealed.includes(index)}
              disabled={!canInteract || !canFlip(game, index)}
              showOwner={game.mode === "online"}
              onClick={() => onFlip(index)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
