import type { Player } from "../lib/game";

interface Props {
  player: Player; // 色分けに使う
  label: string;
  cards: number; // 取ったカードの枚数(そろえたペア数 × 2)
  active: boolean; // 手番のプレイヤーは少し大きく表示する(相手側も薄くはしない)
}

const CHIP_COLORS: Record<Player, string> = {
  1: "bg-p1-bg text-p1-text",
  2: "bg-p2-bg text-p2-text",
};

// オンライン対戦のフッターの左右に置く、プレイヤーごとの取ったカードの枚数
export function ScoreChip({ player, label, cards, active }: Props) {
  return (
    <div
      className={`flex items-baseline gap-1.5 rounded-full px-3 py-1.5 font-heading font-bold shadow-[0_4px_0_rgba(0,0,0,0.08)] transition-all duration-200 ${CHIP_COLORS[player]} ${
        active ? "scale-105" : "scale-95"
      }`}
    >
      <span className="text-sm">{label}</span>
      <span className="text-xl leading-none">{cards}</span>
      <span className="text-xs">まい</span>
    </div>
  );
}
