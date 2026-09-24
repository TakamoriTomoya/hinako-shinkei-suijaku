import { CardCountPicker } from "../components/CardCountPicker";
import { CenterSlot } from "../components/CenterSlot";
import { VersionLabel } from "../components/VersionLabel";
import type { PageSlots } from "../components/BasePage";
import type { CardCount } from "../lib/constants";

interface Props {
  cardCount: CardCount;
  onCardCountChange: (count: CardCount) => void;
  onStartSolo: () => void;
  onStartOnline: () => void;
}

// pages/ はマウント/アンマウントされる画面コンポーネントではなく、
// 「このフェーズならBasePageのスロットに何を入れるか」を決める関数。
export function HomePage({ cardCount, onCardCountChange, onStartSolo, onStartOnline }: Props): PageSlots {
  return {
    header: (
      <div className="grid w-full grid-cols-[30%_60%_10%] items-center px-6">
        <div aria-hidden="true" />
        <div aria-hidden="true" />
        <div className="flex justify-center">
          <VersionLabel />
        </div>
      </div>
    ),
    center: (
      <CenterSlot>
        ひなこの
        <br />
        神経衰弱
      </CenterSlot>
    ),
    bottom: (
      <div className="flex w-full -translate-y-12 flex-col items-center gap-4 px-6">
        <CardCountPicker value={cardCount} onChange={onCardCountChange} />
        <button
          type="button"
          className="pointer-events-auto w-full max-w-[280px] cursor-pointer rounded-full border-0 bg-green py-4 font-heading text-lg font-bold text-white shadow-[0_4px_0_var(--color-green-shadow)] transition-transform duration-100 hover:bg-green-hover active:scale-[0.96]"
          onClick={onStartSolo}
        >
          ひとりで遊ぶ
        </button>
        <button
          type="button"
          className="pointer-events-auto w-full max-w-[280px] cursor-pointer rounded-full border-0 bg-lime py-4 font-heading text-lg font-bold text-white shadow-[0_4px_0_var(--color-lime-shadow)] transition-transform duration-100 hover:bg-lime-hover active:scale-[0.96]"
          onClick={onStartOnline}
        >
          オンラインで対戦
        </button>
      </div>
    ),
  };
}
