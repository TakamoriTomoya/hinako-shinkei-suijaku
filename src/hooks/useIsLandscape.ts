import { useSyncExternalStore } from "react";

const query = "(orientation: landscape)";

function subscribe(onChange: () => void): () => void {
  const mql = window.matchMedia(query);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

// 画面が横長か(スマホを横にした時・PCのブラウザ)。盤面の列数を切り替えるのに使う
export function useIsLandscape(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches);
}
