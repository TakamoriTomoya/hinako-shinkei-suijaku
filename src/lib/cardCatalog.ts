// カードの表に使う画像と名前の一覧。
// 1回のゲームではこの中から(カードの枚数 ÷ 2)種類をランダムに選んで2枚ずつ並べる。
// 24枚を選べるよう、12種類以上を登録しておく(多いほど毎回の顔ぶれが変わる)。
// 新しい画像を public/images/ に追加したら、ここに {file, name} を追記する。
// (元画像は大きいので、`sips -Z 480` 等で縮めてから置くと読み込みが速い)

export interface CardImageDef {
  file: string;
  name: string;
}

export const CARD_IMAGE_FILES: CardImageDef[] = [
  { file: "boy-hinako.png", name: "しょうねんひなこ" },
  { file: "dance-hinako.png", name: "だんすひなこ" },
  { file: "gassho-hinako.png", name: "がっしょうひなこ" },
  { file: "goo-hinako.png", name: "ぐぅーひなこ" },
  { file: "gorori-hinako.png", name: "ごろりひなこ" },
  { file: "gyaku-hinako.png", name: "ぎゃくぅひなこ" },
  { file: "lego-hinako.png", name: "れごひなこ" },
  { file: "mouhu-hinako.png", name: "もうふひなこ" },
  { file: "neko-hinako.png", name: "ねこひなこ" },
  { file: "panpan-hinako.png", name: "ぱんぱんひなこ" },
  { file: "perm-hinako.png", name: "ぱーまひなこ" },
  { file: "red-hinako.png", name: "あかひなこ" },
  { file: "sit-hinako.png", name: "おすわりひなこ" },
  { file: "sorori-hinako.png", name: "そろりひなこ" },
  { file: "tako-hinako.png", name: "たこひなこ" },
  { file: "yazirusi-hinako.png", name: "やじるしひなこ" },
];

export function cardImageSrc(file: string): string {
  return `/images/${file}`;
}
