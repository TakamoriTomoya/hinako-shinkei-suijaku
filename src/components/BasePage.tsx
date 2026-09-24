import type { ReactNode } from "react";

// 各画面(pages/)が埋める3つのスロット。中身が無いスロットはundefinedのままでよい。
export interface PageSlots {
  header?: ReactNode; // ヘッダーエリア: 上に置く小さな帯(例: 手数・得点)
  center?: ReactNode; // 中心エリア: 盤面やタイトル
  bottom?: ReactNode; // ボトムメニューエリア: 下に置く操作ボタン・手番表示
  overlay?: ReactNode; // 盤面の上に重ねるメッセージ(例: 「〇〇ひなこ！」・勝敗)
  compact?: boolean; // trueならヘッダー・ボトムを細くして、中心エリア(盤面)を広く取る
}

const HEADER_CLASS = {
  normal: "h-[15%] pt-[max(1rem,env(safe-area-inset-top))]",
  compact: "h-[calc(3.5rem+max(0.5rem,env(safe-area-inset-top)))] pt-[max(0.5rem,env(safe-area-inset-top))]",
};
const BOTTOM_CLASS = {
  normal: "h-[15%] pb-[max(1rem,env(safe-area-inset-bottom))]",
  compact: "h-[calc(4rem+max(1rem,env(safe-area-inset-bottom)))] pb-[max(1rem,env(safe-area-inset-bottom))]",
};

// 全フェーズ共通の1つのベース画面。りんご柄の背景の上に、各pageが決めたスロットの中身を並べる。
export function BasePage({ header, center, bottom, overlay, compact = false }: PageSlots) {
  const size = compact ? "compact" : "normal";
  return (
    <div className="relative flex h-dvh w-full flex-col overflow-hidden bg-apple">
      <div className={`pointer-events-none relative flex shrink-0 items-center justify-center ${HEADER_CLASS[size]}`}>
        {header}
      </div>
      <div className="pointer-events-none relative flex min-h-0 flex-1 items-center justify-center">{center}</div>
      <div className={`pointer-events-none relative flex shrink-0 items-center justify-center ${BOTTOM_CLASS[size]}`}>
        {bottom}
      </div>
      {overlay}
    </div>
  );
}
