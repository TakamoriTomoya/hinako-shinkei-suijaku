// ゲーム全体の設定値。挙動を変えたい時はここだけを触ればよいようにまとめてある。

// ホームで選べるカードの枚数と、その並べ方。
// columnsは画面が縦長/横長の時の列数(枚数がこれで割り切れるようにする)。
// カードは盤面に使える広さいっぱいまで大きくし、横:縦の比は cardAspect の範囲で広さに合わせて変える
// (24枚は縦長のスマホだと小さくなりがちなので、正方形まで横に広げてよいことにする)。
// maxCardWidthは広い画面でカードが大きくなりすぎないための上限(px)。compactは上下の帯を細くして盤面を広く取るか。
export const CARD_COUNT_OPTIONS = [16, 24] as const;
export type CardCount = (typeof CARD_COUNT_OPTIONS)[number];
export const DEFAULT_CARD_COUNT: CardCount = 16;

export interface BoardLayout {
  columns: { portrait: number; landscape: number };
  cardAspect: { min: number; max: number };
  maxCardWidth: number;
  compact: boolean;
}

export const BOARD_LAYOUTS: Record<CardCount, BoardLayout> = {
  16: { columns: { portrait: 4, landscape: 4 }, cardAspect: { min: 3 / 4, max: 3 / 4 }, maxCardWidth: 104, compact: false },
  24: { columns: { portrait: 4, landscape: 6 }, cardAspect: { min: 3 / 4, max: 1 }, maxCardWidth: 130, compact: true },
};

export function boardLayoutFor(cardCount: number): BoardLayout {
  return BOARD_LAYOUTS[cardCount as CardCount] ?? BOARD_LAYOUTS[DEFAULT_CARD_COUNT];
}

export const FLIP_BACK_MS = 900; // そろわなかった2枚を見せておく時間。過ぎると裏に戻る
export const MATCH_TOAST_MS = 1200; // そろった時に出す「〇〇ひなこ！」の表示時間
