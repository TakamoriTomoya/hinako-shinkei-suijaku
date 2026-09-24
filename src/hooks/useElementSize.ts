import { useCallback, useState } from "react";

export interface Size {
  width: number;
  height: number;
}

// 要素の実際の大きさ(px)を測り続ける。返すrefを測りたい要素に付ける
export function useElementSize<T extends HTMLElement>(): [(el: T | null) => void, Size | null] {
  const [size, setSize] = useState<Size | null>(null);
  const ref = useCallback((el: T | null) => {
    if (!el) return;
    // ResizeObserverは画面に描かれるまで通知しない(裏のタブ等)ので、付けた時点の大きさもすぐ測っておく
    const style = getComputedStyle(el);
    setSize({
      width: el.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
      height: el.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom),
    });
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize((prev) => (prev && prev.width === width && prev.height === height ? prev : { width, height }));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, size];
}
