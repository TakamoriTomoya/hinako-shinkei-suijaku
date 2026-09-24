import { useCallback, useEffect, useState } from "react";
import { BasePage } from "./components/BasePage";
import { LoadingOverlay } from "./components/LoadingOverlay";
import { PeerAwayNotice } from "./components/PeerAwayNotice";
import { HomePage } from "./pages/HomePage";
import { GamePage } from "./pages/GamePage";
import { ResultPage } from "./pages/ResultPage";
import { OnlineLobbyPage } from "./pages/OnlineLobbyPage";
import { OnlineWaitingPage } from "./pages/OnlineWaitingPage";
import { playerOfRole, useMemoryGame } from "./hooks/useMemoryGame";
import { useOnlineRoom } from "./hooks/useOnlineRoom";
import { loadPassphraseHistory, savePassphraseToHistory } from "./lib/passphraseHistory";

type AppMode = "menu" | "online-lobby";

function App() {
  const {
    game,
    phase,
    cardCount,
    assetsReady,
    toast,
    onlineRole,
    rematchWaiting,
    actions,
  } = useMemoryGame();

  const { attachOnlineHost, attachOnlineGuest, resendRematch } = actions;
  const room = useOnlineRoom();
  const [appMode, setAppMode] = useState<AppMode>("menu");
  const [passphrase, setPassphrase] = useState("");
  const [passphraseHistory, setPassphraseHistory] = useState<string[]>(loadPassphraseHistory);

  // 部屋にホスト・ゲストが揃ったら、ゲーム側へ接続を渡して始める
  useEffect(() => {
    if (room.status.step !== "connected") return;
    const sync = room.sync.current;
    if (!sync) return;
    if (room.status.role === "host") attachOnlineHost(sync);
    else attachOnlineGuest(sync);
    // actions全体は盤面が変わるたびに作り直されるので、変わらない関数だけに依存させる(つながった時に1回だけ呼ぶ)
  }, [room.status, room.sync, attachOnlineHost, attachOnlineGuest]);

  // ゲスト: 「もう一度」を押して待っている間にホストが入り直してきたら、押したことを伝え直す
  useEffect(() => {
    if (room.peerPresent) resendRematch();
  }, [room.peerPresent, resendRematch]);

  const handleStartSolo = useCallback(() => actions.start("solo"), [actions]);

  const handleStartOnline = useCallback(() => {
    // 直近に使った合言葉を初期値にして、同じ相手とすぐ遊び直せるようにする
    setPassphrase(passphraseHistory[0] ?? "");
    room.reset();
    setAppMode("online-lobby");
  }, [room, passphraseHistory]);

  const handleLobbyBack = useCallback(() => {
    room.leaveRoom();
    setAppMode("menu");
  }, [room]);

  const handleMatchRoom = useCallback(() => {
    setPassphraseHistory(savePassphraseToHistory(passphrase));
    void room.matchRoom(passphrase);
  }, [room, passphrase]);

  const handleGoHome = useCallback(() => {
    if (onlineRole) room.leaveRoom();
    actions.goHome();
    setAppMode("menu");
  }, [onlineRole, actions, room]);

  const localPlayer = onlineRole === null ? null : playerOfRole(onlineRole);
  const peerAway = onlineRole !== null && !room.peerPresent;
  const isWaitingForPeer = room.status.step === "matching" || room.status.step === "waiting-for-peer";
  // 相手と揃ってゲームに入ったらロビーは閉じる
  const inLobby = appMode === "online-lobby" && onlineRole === null;

  const slots =
    inLobby && isWaitingForPeer
      ? OnlineWaitingPage({ message: `合言葉「${passphrase}」で相手を待っています`, onBack: handleLobbyBack })
      : inLobby
        ? OnlineLobbyPage({
            status: room.status,
            passphrase,
            history: passphraseHistory,
            onPassphraseChange: setPassphrase,
            onMatch: handleMatchRoom,
            onBack: handleLobbyBack,
          })
        : game === null && onlineRole === "guest"
          ? OnlineWaitingPage({ message: "カードをくばっています", onBack: handleGoHome })
          : game === null || phase === "home"
            ? HomePage({
                cardCount,
                onCardCountChange: actions.selectCardCount,
                onStartSolo: handleStartSolo,
                onStartOnline: handleStartOnline,
              })
            : phase === "finished" && rematchWaiting
              ? OnlineWaitingPage({ message: "相手が「もう一度」を押すのを待っています", onBack: handleGoHome })
              : phase === "finished"
                ? ResultPage({
                    game,
                    localPlayer,
                    onHome: handleGoHome,
                    onRestart: actions.restart,
                  })
                : GamePage({ game, localPlayer, toast, onFlip: actions.flip, onHome: handleGoHome });

  return (
    <>
      <BasePage
        {...slots}
        overlay={
          <>
            {slots.overlay}
            {peerAway && <PeerAwayNotice />}
          </>
        }
      />
      <LoadingOverlay ready={assetsReady} />
    </>
  );
}

export default App;
