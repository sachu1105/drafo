import { CalendarClock, Files, MicOff, Shuffle } from "lucide-react";

/**
 * The four failures, which are the whole argument for the product.
 *
 * The list is data rather than markup so that adding a fifth is a decision
 * about the product, taken in one place, instead of a copied div. Four is
 * deliberate: it is exactly what the product claims to fix, and the section
 * says out loud that it does nothing else.
 */
const FAILURES = [
  {
    icon: MicOff,
    title: "Approvals evaporate",
    body:
      "They approve in a voice note, then deny it six months later. You redo "
      + "the work unpaid.",
  },
  {
    icon: Files,
    title: "Five PDFs, all called “plan”",
    body:
      "Nobody can tell which one is current, so the contractor builds from "
      + "the wrong one.",
  },
  {
    icon: Shuffle,
    title: "Material choices scatter",
    body:
      "A year of tile, paint and sanitary decisions, buried in a chat nobody "
      + "can search.",
  },
  {
    icon: CalendarClock,
    title: "Invoicing slips",
    body:
      "The stage is done and payable, but with no agreed record to point at, "
      + "asking slips by weeks.",
  },
];

export function Problem() {
  return (
    <section id="problem" className="scroll-mt-20 border-b border-rule">
      <div className="mx-auto max-w-shell px-4 py-16 sm:px-8 sm:py-24">
        <p className="eyebrow">The four failures</p>
        <h2 className="mt-4 max-w-[22ch] font-display text-display">
          What running a project on WhatsApp actually costs
        </h2>
        <p className="mt-5 max-w-reading text-[1.0625rem] leading-relaxed text-muted">
          Drafo fixes exactly these four things. It deliberately does nothing
          else.
        </p>

        <div className="mt-14 grid gap-x-16 gap-y-14 sm:grid-cols-2">
          {FAILURES.map(({ icon: Icon, title, body }) => (
            <div key={title}>
              
              <Icon
                aria-hidden
                strokeWidth={1.75}
                className="h-7 w-7 text-brand"
              />
              <h3 className="mt-5 font-display text-[1.375rem] leading-snug">
                {title}
              </h3>
              <p className="mt-2.5 max-w-[46ch] text-[0.9375rem] leading-relaxed text-muted">
                {body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
