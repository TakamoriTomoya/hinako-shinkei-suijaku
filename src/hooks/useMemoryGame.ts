import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CARD_IMAGE_FILES, cardImageSrc } from "../lib/cardCatalog";
import { DEFAULT_CARD_COUNT, FLIP_BACK_MS, MATCH_TOAST_MS, type CardCount } from "../lib/constants";
import {
  canFlip,
  createGame,
  flipBack,
  flipCard,
  isFinished,
  isWaitingFlipBack,
  type GameMode,
  type GameState,
  type Player,
} from "../lib/game";
import type { RoomSync } from "../lib/network/roomSync";
import { fromWireGame, toWireGame, type RoomRole } from "../lib/network/types";

export type Phase = "home" | "playing" | "finished";

// オンライン対戦ではホスト=プレイヤー1、ゲスト=プレイヤー2
export function playerOfRole(role: RoomRole): Player {
  return role === "host" ? 1 : 2;
}

// 画像をすべて先に読み込んでおく(初めてめくった時に表が真っ白にならないように)
function preloadImages(): Promise<void> {
  return Promise.all(
    CARD_IMAGE_FILES.map(
      (def) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = img.onerror = () => resolve();
          img.src = cardImageSrc(def.file);
        }),
    ),
  ).then(() => undefined);
}

// 神経衰弱1ゲーム分の状態と、めくる/裏に戻すなどの時間まわりを受け持つフック。
// ルール自体は lib/game.ts の純粋な関数に任せる。
//
// オンライン対戦はホスト権威モデル: ホストだけが盤面を持ってルールを進め、変わるたびにゲストへ配信する。
// ゲストは自分の手番にめくったカードをホストへ送り、配信された盤面をそのまま表示する
// (待たずに済むよう、めくった1枚だけは手元でも先に表にしておく)。
export function useMemoryGame() {
  const [game, setGame] = useState<GameState | null>(null);
  const [cardCount, setCardCount] = useState<CardCount>(DEFAULT_CARD_COUNT); // ホームで選んだ枚数(オンラインではホストの選択を使う)
  // startから読む用。startが枚数に依存して作り直されると、オンラインの接続処理までやり直されてしまうため
  const cardCountRef = useRef<CardCount>(DEFAULT_CARD_COUNT);
  const [gameId, setGameId] = useState(0); // 新しいゲームを始めるたびに変わる(オンラインではホストが決める)
  const [assetsReady, setAssetsReady] = useState(false);
  const [toastDismissed, setToastDismissed] = useState<string | null>(null); // 表示時間が過ぎた「そろった」演出のキー
  const [onlineRole, setOnlineRole] = useState<RoomRole | null>(null);
  // オンライン対戦の決着後に自分が「もう一度」を押し、相手が押すのを待っている間true
  const [rematchWaiting, setRematchWaiting] = useState(false);

  const syncRef = useRef<RoomSync | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);
  // ホスト専用: 決着後にそれぞれが「もう一度」を押したか(両方揃ったら次のゲームを始める)
  const rematchRef = useRef({ local: false, remote: false });
  // ゲスト専用: 「もう一度」を押して、次のゲームが届くのを待っている間true
  const guestRematchPendingRef = useRef(false);
  // ホスト専用: ゲストの操作を受け取った時点の盤面(購読のコールバックから最新の値を見るため)
  const gameRef = useRef<GameState | null>(null);
  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  useEffect(() => {
    let cancelled = false;
    void preloadImages().then(() => {
      if (!cancelled) setAssetsReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const finished = game !== null && isFinished(game);
  const phase: Phase = game === null ? "home" : finished ? "finished" : "playing";

  // そろわなかった2枚は少し見せてから裏に戻す(オンラインのゲストはホストから届くのを待つ)
  const waitingFlipBack = game !== null && isWaitingFlipBack(game);
  useEffect(() => {
    if (!waitingFlipBack || onlineRole === "guest") return;
    const timer = setTimeout(() => setGame((g) => (g ? flipBack(g) : g)), FLIP_BACK_MS);
    return () => clearTimeout(timer);
  }, [waitingFlipBack, onlineRole]);

  // そろった時に名前を少しだけ出す。
  // lastMatchはそろわなかった後も残り続けるので、手数ではなく「どのゲームのどのカードがそろったか」で区別する
  // (カードは1ゲームで1回しかそろわないので、これで同じ「そろった」を二度出さない。
  //  ゲストには同じ盤面が何度も届き得るため、カードのオブジェクトそのものでは比べない)
  const lastMatch = game?.lastMatch ?? null;
  const toastKey = lastMatch ? `${gameId}:${lastMatch.id}` : null;
  const toast = lastMatch && toastKey !== toastDismissed ? `${lastMatch.name}！` : null;
  useEffect(() => {
    if (!toastKey) return;
    const timer = setTimeout(() => setToastDismissed(toastKey), MATCH_TOAST_MS);
    return () => clearTimeout(timer);
  }, [toastKey]);

  // ホスト: 盤面が変わるたびにゲストへ配信する
  useEffect(() => {
    if (onlineRole !== "host" || !game) return;
    syncRef.current?.sendSnapshot({ gameId, game: toWireGame(game) });
  }, [onlineRole, game, gameId]);

  const resetForNewGame = useCallback((next: GameState, id: number) => {
    setGame(next);
    setGameId(id);
    setRematchWaiting(false);
    rematchRef.current = { local: false, remote: false };
  }, []);

  const start = useCallback(
    (mode: GameMode) => resetForNewGame(createGame(mode, CARD_IMAGE_FILES, cardCountRef.current / 2), Date.now()),
    [resetForNewGame],
  );

  const selectCardCount = useCallback((count: CardCount) => {
    cardCountRef.current = count;
    setCardCount(count);
  }, []);

  const flip = useCallback(
    (index: number) => {
      if (!game) return;
      // オンライン対戦では自分の手番の時だけめくれる
      if (onlineRole !== null && game.turnPlayer !== playerOfRole(onlineRole)) return;
      if (!canFlip(game, index)) return;
      const next = flipCard(game, index);
      setGame(next);
      if (onlineRole === "guest") syncRef.current?.sendInput({ type: "flip", index });
    },
    [game, onlineRole],
  );

  // 決着後の「もう一度」。オンライン対戦は、部屋に入った時と同じく相手も押すまで待ってから始める
  const restart = useCallback(() => {
    if (!game) return;
    if (onlineRole === null) {
      start(game.mode);
      return;
    }
    setRematchWaiting(true);
    if (onlineRole === "guest") {
      guestRematchPendingRef.current = true;
      syncRef.current?.sendInput({ type: "restart" });
      return;
    }
    rematchRef.current.local = true;
    if (rematchRef.current.remote) start("online");
  }, [game, onlineRole, start]);

  // ゲスト: 待っている間にホストが抜けて入り直すと押したことが消えるので、伝え直す
  const resendRematch = useCallback(() => {
    if (guestRematchPendingRef.current) syncRef.current?.sendInput({ type: "restart" });
  }, []);

  const detachOnline = useCallback(() => {
    unsubRef.current?.();
    unsubRef.current = null;
    syncRef.current = null;
    guestRematchPendingRef.current = false;
    setOnlineRole(null);
    setRematchWaiting(false);
  }, []);

  const goHome = useCallback(() => {
    detachOnline();
    setGame(null);
  }, [detachOnline]);

  // ホストとして部屋に入った。途中で抜けて入り直した時は、最後に配信していた盤面から続ける
  const attachOnlineHost = useCallback(
    (sync: RoomSync) => {
      unsubRef.current?.();
      syncRef.current = sync;
      setOnlineRole("host");
      const restored = sync.restoredSnapshot;
      if (restored) resetForNewGame(fromWireGame(restored.game), restored.gameId);
      else start("online");
      unsubRef.current = sync.onRemoteInput((event) => {
        if (event.type === "flip") {
          setGame((g) => (g && g.turnPlayer === 2 ? flipCard(g, event.index) : g));
          return;
        }
        // 決着前に届いた「もう一度」(前のゲームの分が遅れて届いた等)は無視する
        const current = gameRef.current;
        if (!current || !isFinished(current)) return;
        rematchRef.current.remote = true;
        if (rematchRef.current.local) start("online");
      });
    },
    [resetForNewGame, start],
  );

  // ゲストとして部屋に入った。盤面はホストから届くまで空のまま
  const attachOnlineGuest = useCallback((sync: RoomSync) => {
    unsubRef.current?.();
    syncRef.current = sync;
    setOnlineRole("guest");
    setGame(null);
    unsubRef.current = sync.onSnapshot((snapshot) => {
      const next = fromWireGame(snapshot.game);
      setGame(next);
      setGameId(snapshot.gameId);
      // 次のゲームが始まったら「もう一度」の待機を終える
      if (!isFinished(next)) {
        guestRematchPendingRef.current = false;
        setRematchWaiting(false);
      }
    });
  }, []);

  const actions = useMemo(
    () => ({
      start,
      selectCardCount,
      flip,
      restart,
      resendRematch,
      goHome,
      attachOnlineHost,
      attachOnlineGuest,
      detachOnline,
    }),
    [start, selectCardCount, flip, restart, resendRematch, goHome, attachOnlineHost, attachOnlineGuest, detachOnline],
  );

  return {
    game,
    phase,
    cardCount,
    assetsReady,
    toast,
    onlineRole,
    rematchWaiting,
    actions,
  };
}
