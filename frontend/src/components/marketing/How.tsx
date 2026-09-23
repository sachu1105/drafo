/**
 * How it works, on the one dark band in the page.
 *
 * The band is structural, not decorative: six sections of near-white in a row
 * leave the page looking bleached, so this and the footer bracket the light
 * ones between them.
 *
 * Three steps, and the copy has to keep proving that none of them is a new
 * habit -- the client already has WhatsApp and a browser, and a fourth step
 * would be a fourth chance to lose them.
 */

const STEPS = [
  {
    title: "Upload the drawing",
    body:
      "A project, a drawing set, a PDF. Revisions stack up under it, "
      + "numbered, with your note on what changed.",
  },
  {
    title: "Send the link on WhatsApp",
    body:
      "One tap opens WhatsApp with the message written and the private link "
      + "already in it.",
  },
  {
    title: "They approve, you have a record",
    body:
      "They open it on their phone, type their name once, and tap Approve. "
      + "Name, date and time, permanently.",
  },
];
export function How() {
  return (
    <section id="how" className="scroll-mt-20 bg-brandDark text-paper">
      <div className="mx-auto max-w-shell px-4 py-20 sm:px-8 sm:py-28">
        <p className="eyebrow text-sand">How it works</p>
        <h2 className="mt-4 max-w-[20ch] font-display text-display">
          Three steps, and none of them are new habits
        </h2>

        <ol className="mt-16 grid gap-12 md:grid-cols-3 md:gap-10">
          {STEPS.map((step, index) => (
            <li key={step.title}>
             
              <div className="flex items-center gap-5">
                <span
                  aria-hidden
                  className="font-display text-[2.75rem] leading-none tabular-nums text-sage"
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span aria-hidden className="h-px flex-1 bg-paper/25" />
              </div>

              <h3 className="mt-7 font-display text-[1.5rem] leading-snug md:min-h-[4.125rem]">
                {step.title}
              </h3>
              <p className="mt-3 max-w-[32ch] text-[0.9375rem] leading-relaxed text-sand">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
