export default function StatusBadge({ status }) {
  const className =
    status === "healthy"
      ? "border border-[rgba(248,201,180,0.4)] bg-[rgba(235,91,44,0.22)] text-[#f8c9b4]"
      : status === "degraded"
      ? "border border-[rgba(44,49,136,0.65)] bg-[rgba(44,49,136,0.35)] text-[#e8e6e6]"
      : status === "offline"
      ? "border border-[rgba(235,91,44,0.45)] bg-[rgba(36,31,32,0.5)] text-[#f8c9b4]"
      : "border border-[rgba(232,230,230,0.35)] bg-[rgba(232,230,230,0.12)] text-[#e8e6e6]";

  const label =
    status === "healthy"
      ? "Backend connected"
      : status === "degraded"
      ? "API online, DB not connected"
      : status === "offline"
      ? "Backend unavailable"
      : "Backend not checked";

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}
