/** A quiet section: a rubric, a hairline, and then the content. */
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
    <section className="rule-top pt-5">
      <div className="mb-1 flex items-baseline justify-between">
        <h2 className="eyebrow">{label}</h2>
        {count !== undefined && count > 0 ? (
          <span className="text-label text-faint tabular-nums">{count}</span>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-[0.9375rem] text-faint">{children}</p>;
}
