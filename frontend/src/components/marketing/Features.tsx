import { FeatureAccordion } from "@/components/marketing/FeatureAccordion";

/**
 * What you get.
 *
 * Almost nothing lives here: the section is a heading and an accordion, and
 * the accordion holds the content and the interactivity. Kept as its own file
 * anyway, so the page reads as five sections rather than four sections and an
 * exception.
 */
export function Features() {
  return (
    <section id="features" className="scroll-mt-20 border-b border-rule">
      <div className="mx-auto max-w-shell px-4 py-16 sm:px-8 sm:py-24">
        <p className="eyebrow">What you get</p>
        <h2 className="mt-4 max-w-[20ch] font-display text-display">
          Built around the record, not around features
        </h2>

        <div className="mt-12">
          <FeatureAccordion />
        </div>
      </div>
    </section>
  );
}
