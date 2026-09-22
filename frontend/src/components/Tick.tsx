/**
 * A check mark for positive states.
 *
 * The palette is monochrome green, so "approved" and ordinary body text sit
 * only a shade apart — and colour alone would exclude anyone colour-blind
 * regardless. Every approved or paid state carries this glyph as well.
 */
export function Tick({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 12 12"
      className={`inline-block h-3 w-3 shrink-0 ${className}`}
    >
      <path
        d="M2 6.4 4.6 9 10 3.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
