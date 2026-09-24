import { CARD_COUNT_OPTIONS, type CardCount } from "../lib/constants";

interface Props {
  value: CardCount;
  onChange: (count: CardCount) => void;
}

// ホームで選ぶカードの枚数(ひとりで遊ぶ・オンラインで対戦のどちらにも使う)
export function CardCountPicker({ value, onChange }: Props) {
  return (
    <div
      className="pointer-events-auto flex rounded-full bg-bg-cream/95 p-1 shadow-[0_4px_0_rgba(0,0,0,0.08)]"
      role="radiogroup"
      aria-label="カードの枚数"
    >
      {CARD_COUNT_OPTIONS.map((count) => {
        const selected = count === value;
        return (
          <button
            key={count}
            type="button"
            role="radio"
            aria-checked={selected}
            className={`cursor-pointer rounded-full border-0 px-5 py-1.5 font-heading text-base font-bold transition-colors duration-100 ${
              selected ? "bg-primary text-white" : "bg-transparent text-text-light hover:text-text-dark"
            }`}
            onClick={() => onChange(count)}
          >
            {count}まい
          </button>
        );
      })}
    </div>
  );
}
