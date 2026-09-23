/**
 * A phone showing the client's screen.
 *
 * Drawn rather than screenshotted so it stays honest when the real screen
 * changes, and so it weighs nothing on a slow connection. The plan inside is
 * line art for the same reason.
 */
export function PortalPreview() {
  return (
    <div className="mx-auto w-full max-w-[320px]" aria-hidden>
      <div className="border border-rule bg-card p-3 shadow-menu">
        {/* letterhead */}
        <div className="border-b border-ruleSoft pb-2.5">
          <p className="font-display text-[0.9375rem] leading-none">
            Anna Mathew Architects
          </p>
        </div>

        <div className="pt-3">
          <p className="font-display text-[1.125rem] leading-tight">
            Ground Floor Plan
          </p>
          <p className="mt-0.5 text-[0.6875rem] text-muted">
            Revision 2 · current
          </p>

          <FloorPlan />

          <div className="mt-3 border-t border-ruleSoft pt-3">
            <div className="flex h-9 items-center justify-center bg-brand text-[0.75rem] font-medium text-paper">
              Approve this drawing
            </div>
            <p className="mt-1.5 text-center text-[0.625rem] text-faint">
              Your name and the date and time are recorded.
            </p>
          </div>

          <div className="mt-3 border-t border-ruleSoft pt-2.5">
            <p className="text-[0.625rem] uppercase tracking-[0.14em] text-faint">
              Previous revisions (1)
            </p>
            <p className="mt-1 text-[0.6875rem] text-accent">
              Revision 1 approved by P. J. Thomas
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function FloorPlan() {
  return (
    <svg
      viewBox="0 0 280 180"
      className="mt-3 w-full border border-rule bg-sheet"
      role="presentation"
    >
      <g
        fill="none"
        stroke="rgb(var(--ink))"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      >
        <rect x="14" y="14" width="252" height="152" />
      </g>
      <g fill="none" stroke="rgb(var(--ink))" strokeWidth="1">
        <path d="M120 14v90M120 104h146M196 104v62M14 118h106" />
      </g>
      <g fill="rgb(var(--sand))" stroke="none">
        <rect x="16" y="16" width="102" height="100" />
      </g>
      <g
        fill="rgb(var(--muted))"
        fontSize="7"
        fontFamily="var(--font-body), system-ui, sans-serif"
        letterSpacing="0.06em"
      >
        <text x="24" y="34">LIVING</text>
        <text x="132" y="34">KITCHEN</text>
        <text x="206" y="124">BED 1</text>
        <text x="24" y="140">VERANDAH</text>
      </g>
    </svg>
  );
}
