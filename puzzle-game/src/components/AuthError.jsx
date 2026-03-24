export default function AuthError({ message, onClear }) {
  if (!message) {
    return null;
  }

  return (
    <div className="rounded-xl border border-[rgba(215,99,72,0.5)] bg-[rgba(244,201,188,0.55)] p-3 text-sm text-[#6a2f1f]">
      <div className="flex items-start justify-between gap-4">
        <p>{message}</p>
        <button
          type="button"
          className="rounded-md bg-[rgba(121,150,225,0.28)] px-2 py-1 text-xs text-[#2b3562] hover:bg-[rgba(121,150,225,0.45)]"
          onClick={onClear}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
