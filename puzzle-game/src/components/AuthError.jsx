export default function AuthError({ message, onClear }) {
  if (!message) {
    return null;
  }

  return (
    <div className="rounded-xl border border-[rgba(235,91,44,0.55)] bg-[rgba(235,91,44,0.16)] p-3 text-sm text-[#f8c9b4]">
      <div className="flex items-start justify-between gap-4">
        <p>{message}</p>
        <button
          type="button"
          className="rounded-md bg-[rgba(44,49,136,0.45)] px-2 py-1 text-xs text-[#e8e6e6] hover:bg-[rgba(44,49,136,0.7)]"
          onClick={onClear}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
