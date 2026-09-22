/**
 * A section of the client's page.
 *
 * The rubric used to be an 11px uppercase label in the faintest grey in the
 * palette, which on a phone in daylight, read by someone over fifty, is
 * roughly invisible. Drawings, Materials and Payments are the three things
 * this page is, so they are now set as headings people can actually see.
 */
export function Section({
  label,
  count,
  children,
}: {
  label: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-4 flex items-baseline justify-between gap-4 border-b border-rule pb-2.5">
        <h2 className="font-display text-[1.375rem] leading-none tracking-tight">
          {label}
        </h2>
        {count !== undefined && count > 0 ? (
          <span className="text-[0.8125rem] tabular-nums text-faint">{count}</span>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-4 text-[0.9375rem] text-faint">{children}</p>;
}
