import { cardImageSrc } from "../lib/cardCatalog";
import type { Card } from "../lib/game";

interface Props {
  card: Card;
  width: number; // px。盤面の広さと枚数から Board が決める
  height: number;
  faceUp: boolean;
  disabled: boolean;
  showOwner: boolean; // オンライン対戦では、そろえたプレイヤーの色で縁取る
  onClick: () => void;
}

const OWNER_RING: Record<1 | 2, string> = {
  1: "ring-4 ring-p1-text",
  2: "ring-4 ring-p2-text",
};

// 1枚のカード。表(写真)と裏(赤いりんご色の「ひ」)を背中合わせに重ね、Y軸回転でめくる
export function MemoryCard({ card, width, height, faceUp, disabled, showOwner, onClick }: Props) {
  const matched = card.matchedBy !== null;
  const ring = matched && showOwner ? OWNER_RING[card.matchedBy!] : "";
  return (
    <button
      type="button"
      className="card-scene @container cursor-pointer border-0 bg-transparent p-0 disabled:cursor-default"
      style={{ width, height }}
      aria-label={faceUp ? card.name : "うらむきのカード"}
      disabled={disabled}
      onClick={onClick}
    >
      <div className={`card-inner h-full w-full ${faceUp ? "is-flipped" : ""}`}>
        <div className="card-face flex items-center justify-center rounded-[min(14px,18cqw)] border-[3px] border-white bg-[var(--color-apple)] shadow-[0_4px_0_var(--color-apple-shadow)]">
          <span className="font-heading text-[45cqw] leading-none font-extrabold text-white/90">ひ</span>
        </div>
        <div
          className={`card-face card-back-face overflow-hidden rounded-[min(14px,18cqw)] border-[3px] border-frame-yellow bg-bg-cream shadow-[0_4px_0_rgba(0,0,0,0.12)] ${ring} ${
            matched ? "matched-pop" : ""
          }`}
        >
          <img className="h-full w-full object-contain p-1" src={cardImageSrc(card.file)} alt="" draggable={false} />
        </div>
      </div>
    </button>
  );
}
