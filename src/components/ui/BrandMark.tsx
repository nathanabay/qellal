// Signal logo mark: a red countdown wedge (~74°) on a filled circle. On light
// surfaces the circle is ink; on dark/ink panels pass tone="dark" so the circle
// is paper and the wedge stays legible.
export function BrandMark({
  className = "h-5 w-5",
  tone = "light",
}: {
  className?: string;
  tone?: "light" | "dark";
}) {
  const rest = tone === "dark" ? "#F4F1EA" : "#17140D";
  return (
    <span
      aria-hidden="true"
      className={`inline-block ${className} rounded-full align-middle`}
      style={{ background: `conic-gradient(#E8462F 0 74deg, ${rest} 0)` }}
    />
  );
}
