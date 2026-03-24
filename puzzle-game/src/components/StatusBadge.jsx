export default function StatusBadge({ status }) {
  const className =
    status === "healthy"
      ? "border border-[rgba(71,146,106,0.38)] bg-[rgba(94,181,133,0.16)] text-[#1f5a3f]"
      : status === "degraded"
      ? "border border-[rgba(199,147,61,0.45)] bg-[rgba(255,213,133,0.28)] text-[#724d14]"
      : status === "offline"
      ? "border border-[rgba(215,99,72,0.45)] bg-[rgba(244,201,188,0.55)] text-[#7a2f1c]"
      : "border border-[rgba(121,150,225,0.45)] bg-[rgba(214,224,247,0.72)] text-[#2d3f75]";

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
