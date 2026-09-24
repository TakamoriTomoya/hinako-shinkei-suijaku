// オンライン対戦の部屋(合言葉)まわりを扱うクラス。
// Firebase Realtime Databaseの詳細をここに閉じ込め、Reactフック側は
// RemoteInputPayload/Snapshotのやり取りだけを意識すればよいようにする。
//
// 部屋はタワーバトルと同じFirebaseプロジェクトの rooms/ 配下に置く(データベースのルールを共有できるように)。
// 同じ合言葉でもタワーバトルの部屋とぶつからないよう、部屋IDに "shinkei-" を付けて分ける。
//
// データ構造:
//   rooms/{roomId}/hostPresent  : boolean
//   rooms/{roomId}/guestPresent : boolean
//   rooms/{roomId}/hostSeenAt   : number (ホストの最終生存確認。一定間隔で更新する)
//   rooms/{roomId}/guestSeenAt  : number (ゲストの最終生存確認)
//   rooms/{roomId}/touchedAt    : number (どちらかの最終生存確認。放置された部屋の掃除に使う)
//   rooms/{roomId}/createdAt    : number
//   rooms/{roomId}/hostToGuest  : Snapshot (ホストが書く。ゲストが購読。常に最新の盤面だけあればよいので上書き)
//   rooms/{roomId}/guestInputs  : {pushId: RemoteInputPayload} (ゲストが追加し、ホストが処理したら消す)
//
// ゲストの操作を上書き1件ではなく一覧に積むのは、すばやく2枚めくった時などに
// 途中の書き込みが間引かれて1枚目のめくりが届かない、ということを起こさないため。
//
// どちらかが抜けても部屋と最後のスナップショットは残り、同じ合言葉で入り直すと同じ役割で再開する。
//
// presenceはonDisconnectで落とすが、スマホのバックグラウンド化などでサーバーが切断に気付かず
// trueのまま残ることがある。そのため生存確認(SeenAt)が途絶えた席は空席とみなし、
// 誰も生存確認していない部屋は、次に誰かが合言葉を入力した時にまとめて掃除する。

import {
  child,
  endAt,
  get,
  onChildAdded,
  onDisconnect,
  onValue,
  orderByChild,
  push,
  query,
  ref,
  remove,
  runTransaction,
  serverTimestamp,
  set,
  update,
  type DatabaseReference,
} from "firebase/database";
import { getFirebaseDatabase } from "./firebaseClient";
import { RoomError, type RemoteInputPayload, type RoomRole, type Snapshot } from "./types";

function normalizePassphrase(passphrase: string): string {
  return passphrase.trim().toLowerCase();
}

// 合言葉(任意の文字列)をRTDBのキーとして使える形(英数字+ハイフンのみ)に変換する。
// FNV-1a系のハッシュを2種類かけ合わせて衝突しにくくしている(暗号目的ではない)。
function hashPassphrase(passphrase: string): string {
  const normalized = normalizePassphrase(passphrase);
  let h1 = 0x811c9dc5;
  let h2 = 0x1000193;
  for (let i = 0; i < normalized.length; i++) {
    const c = normalized.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x85ebca6b) >>> 0;
  }
  return `shinkei-room-${h1.toString(16)}${h2.toString(16)}`;
}

const HEARTBEAT_INTERVAL_MS = 10_000;
// バックグラウンドのタブはタイマーが1分に1回程度まで間引かれるため、それより長めに取る
const SEAT_STALE_MS = 90_000; // これだけ生存確認が途絶えた席は空席とみなす
const ROOM_STALE_MS = 3 * 60_000; // これだけ誰も生存確認していない部屋は消す

// サーバー時刻の推定値(端末の時計ずれを補正する)
// (.info配下はget()では読めないため、onValueの初回通知だけを使う)
function estimateServerNow(): Promise<number> {
  const db = getFirebaseDatabase();
  return new Promise((resolve) => {
    onValue(
      ref(db, ".info/serverTimeOffset"),
      (snap) => resolve(Date.now() + ((snap.val() as number | null) ?? 0)),
      { onlyOnce: true },
    );
  });
}

// 誰もいないまま放置された部屋を消す(失敗しても対戦には影響しないので握りつぶす)
async function sweepStaleRooms(now: number, keepRoomId: string): Promise<void> {
  try {
    const db = getFirebaseDatabase();
    const stale = await get(query(ref(db, "rooms"), orderByChild("touchedAt"), endAt(now - ROOM_STALE_MS)));
    const removals: Promise<void>[] = [];
    stale.forEach((room) => {
      if (room.key && room.key !== keepRoomId) removals.push(remove(room.ref));
    });
    await Promise.all(removals);
  } catch {
    // 掃除できなくても、放置された部屋は同じ合言葉で次に入った人が作り直すので実害はない
  }
}

function isSeatLive(present: boolean | undefined, seenAt: number | undefined, now: number): boolean {
  return present === true && seenAt !== undefined && now - seenAt < SEAT_STALE_MS;
}

interface RoomRecord {
  hostPresent?: boolean;
  guestPresent?: boolean;
  hostSeenAt?: number;
  guestSeenAt?: number;
  touchedAt?: number;
  createdAt?: number;
  hostToGuest?: Snapshot;
  guestInputs?: Record<string, RemoteInputPayload> | null;
}

export class RoomSync {
  readonly roomId: string;
  readonly role: RoomRole;
  // ホストとして途中の対戦に入り直した時の、抜ける直前の状態(新しい対戦ならnull)
  readonly restoredSnapshot: Snapshot | null;
  private readonly roomRef: DatabaseReference;
  private readonly hostPresentRef: DatabaseReference;
  private readonly guestPresentRef: DatabaseReference;
  private readonly hostToGuestRef: DatabaseReference;
  private readonly guestInputsRef: DatabaseReference;
  // 入り直した時に前回の送信と連番が重なって受信側で捨てられないよう、時刻を起点にする
  private outSeq = Date.now();
  private disposed = false;
  private cleanupUnsub: (() => void) | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  private constructor(roomId: string, role: RoomRole, restoredSnapshot: Snapshot | null) {
    const db = getFirebaseDatabase();
    this.roomId = roomId;
    this.role = role;
    this.restoredSnapshot = restoredSnapshot;
    this.roomRef = ref(db, `rooms/${roomId}`);
    this.hostPresentRef = child(this.roomRef, "hostPresent");
    this.guestPresentRef = child(this.roomRef, "guestPresent");
    this.hostToGuestRef = child(this.roomRef, "hostToGuest");
    this.guestInputsRef = child(this.roomRef, "guestInputs");
  }

  // 合言葉で対戦相手を待ち合わせる。部屋を「作る/入る」の区別はなく、
  // ホストがいなければホストとして、ホストがいてゲストがいなければゲストとして入る。
  // 途中で抜けた人が同じ合言葉で入り直すと、抜けた時と同じ役割で対戦に戻れる。
  static async matchRoom(passphrase: string): Promise<RoomSync> {
    const roomId = hashPassphrase(passphrase);
    const db = getFirebaseDatabase();
    const roomRef = ref(db, `rooms/${roomId}`);
    // トランザクション関数はサーバー値との食い違いで再実行されるため、
    // 最後に実行された(=コミットされた)分岐の結果を採用する。
    const now = await estimateServerNow();
    void sweepStaleRooms(now, roomId);
    let role: RoomRole = "host";
    let restoredSnapshot: Snapshot | null = null;
    const result = await runTransaction(roomRef, (current: RoomRecord | null) => {
      const hostLive = isSeatLive(current?.hostPresent, current?.hostSeenAt, now);
      const guestLive = isSeatLive(current?.guestPresent, current?.guestSeenAt, now);
      if (!hostLive) {
        role = "host";
        // ゲストが待っている=対戦の途中でホストが抜けた。最後のスナップショットから再開する。
        // (ゲストも不在なら前の対戦の残骸なので、新しい部屋として作り直す)
        // 抜けていた間のゲスト入力が残っていると再開直後に適用されてしまうため、guestInputsは消す。
        if (current && guestLive && current.hostToGuest) {
          restoredSnapshot = current.hostToGuest;
          return { ...current, hostPresent: true, hostSeenAt: now, touchedAt: now, guestInputs: null };
        }
        restoredSnapshot = null;
        return { hostPresent: true, hostSeenAt: now, guestPresent: false, touchedAt: now, createdAt: now };
      }
      if (guestLive) return undefined; // 既に2人揃っている → 中断
      role = "guest";
      return { ...current, guestPresent: true, guestSeenAt: now, touchedAt: now, guestInputs: null };
    });
    if (!result.committed) {
      throw new RoomError("full", "その合言葉ではすでに2人が対戦中です");
    }
    const sync = new RoomSync(roomId, role, restoredSnapshot);
    sync.watchDisconnectCleanup();
    sync.startHeartbeat();
    return sync;
  }

  // 在室中であることを一定間隔でサーバーに知らせる(途絶えた席は他の人が入れる空席になる)
  private startHeartbeat(): void {
    const seenKey = this.role === "host" ? "hostSeenAt" : "guestSeenAt";
    this.heartbeatTimer = setInterval(() => {
      if (this.disposed) return;
      void update(this.roomRef, { [seenKey]: serverTimestamp(), touchedAt: serverTimestamp() });
    }, HEARTBEAT_INTERVAL_MS);
  }

  // 自分の接続が(アプリを閉じる等で)突然切れた時の後始末をサーバーに予約しておく。
  // 相手が在室中なら自分のpresenceだけ落として部屋を残し(相手が待っている所へ入り直せるように)、
  // 相手が不在=自分が最後の1人なら部屋ごと消す(誰もいない部屋が残り続けないように)。
  // 相手の在室状況が変わるたびに予約を掛け替える。
  private watchDisconnectCleanup(): void {
    const peerPresenceRef = this.role === "host" ? this.guestPresentRef : this.hostPresentRef;
    const off = onValue(peerPresenceRef, (snap) => {
      if (this.disposed) return;
      // cancelは子ノード(presence)の予約もまとめて取り消すため、毎回掛け直す
      void onDisconnect(this.roomRef).cancel();
      if (snap.val() === true) void onDisconnect(this.myPresenceRef()).set(false);
      else void onDisconnect(this.roomRef).remove();
    });
    this.cleanupUnsub = () => off();
  }

  private myPresenceRef(): DatabaseReference {
    return this.role === "host" ? this.hostPresentRef : this.guestPresentRef;
  }

  // 相手の在室状況が変わるたびに呼ばれる(入室・退室・入り直しのいずれも)
  onPeerPresence(handler: (present: boolean) => void): () => void {
    const presenceRef = this.role === "host" ? this.guestPresentRef : this.hostPresentRef;
    const off = onValue(presenceRef, (snap) => handler(snap.val() === true));
    return () => off();
  }

  // ホスト専用: 現在の盤面を配信する
  sendSnapshot(snapshot: Omit<Snapshot, "seq">): void {
    this.outSeq++;
    void set(this.hostToGuestRef, { ...snapshot, seq: this.outSeq });
  }

  // ゲスト専用: ホストからのスナップショットを購読する
  onSnapshot(handler: (snapshot: Snapshot) => void): () => void {
    let lastSeq = -1;
    const off = onValue(this.hostToGuestRef, (snap) => {
      const val = snap.val() as Snapshot | null;
      if (!val || val.seq === lastSeq) return;
      lastSeq = val.seq;
      handler(val);
    });
    return () => off();
  }

  // ゲスト専用: 自分の操作をホストへ送る(送った順に届く)
  sendInput(event: RemoteInputPayload): void {
    void set(push(this.guestInputsRef), event);
  }

  // ホスト専用: ゲストからの操作を届いた順に受け取り、受け取ったものは消す
  onRemoteInput(handler: (event: RemoteInputPayload) => void): () => void {
    const off = onChildAdded(this.guestInputsRef, (snap) => {
      const val = snap.val() as RemoteInputPayload | null;
      void remove(snap.ref);
      if (val) handler(val);
    });
    return () => off();
  }

  // 部屋から退出する。相手が残っていれば対戦の状態ごと部屋を残し(入り直せるように)、
  // 自分が最後の1人なら部屋ごと消す。
  async leave(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    this.cleanupUnsub?.();
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    const presenceRef = this.myPresenceRef();
    await onDisconnect(this.roomRef).cancel();
    const peerKey = this.role === "host" ? "guestPresent" : "hostPresent";
    const result = await runTransaction(this.roomRef, (current: RoomRecord | null) => {
      if (!current) return current;
      if (!current[peerKey]) return null;
      return this.role === "host" ? { ...current, hostPresent: false } : { ...current, guestPresent: false, guestInputs: null };
    });
    if (!result.committed) await set(presenceRef, false);
  }
}
