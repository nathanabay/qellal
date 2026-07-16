// Signal logo mark: an ink circle with a red countdown wedge (~74°).
export function BrandMark({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`${className} rounded-full`}
      style={{ background: "conic-gradient(#E8462F 0 74deg, #17140D 0)" }}
    />
  );
}
