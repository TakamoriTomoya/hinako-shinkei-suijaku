interface Props {
  message: string | null;
}

// そろった時に盤面の上へ一瞬だけ出す「〇〇ひなこ！」
export function MatchToast({ message }: Props) {
  if (!message) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-center px-4">
      <p
        key={message}
        className="toast-pop text-outline font-heading text-[34px] leading-[1.15] font-extrabold whitespace-nowrap text-white"
      >
        {message}
      </p>
    </div>
  );
}
