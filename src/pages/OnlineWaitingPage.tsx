import { BackButton } from "../components/BackButton";
import { CenterSlot } from "../components/CenterSlot";
import type { PageSlots } from "../components/BasePage";

interface Props {
  message: string;
  onBack: () => void; // 待つのをやめる
}

// 「対戦する」や決着後の「もう一度」を押してから相手が揃うまでの画面
export function OnlineWaitingPage({ message, onBack }: Props): PageSlots {
  return {
    header: <BackButton onClick={onBack} />,
    center: (
      <>
        <CenterSlot>待機中…</CenterSlot>
        <div className="pointer-events-none absolute top-[40%] inset-x-0 flex justify-center px-4">
          <p className="rounded-full bg-bg-cream/95 px-4 py-2 text-center font-heading text-sm font-bold text-text-dark shadow-[0_4px_0_rgba(0,0,0,0.08)]">
            {message}
          </p>
        </div>
      </>
    ),
  };
}
