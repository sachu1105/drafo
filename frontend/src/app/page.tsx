import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  CalendarClock,
  EyeOff,
  Files,
  Globe,
  MicOff,
  MousePointerClick,
  Shuffle,
  Stamp,
  UserX,
} from "lucide-react";
import { FeatureAccordion } from "@/components/marketing/FeatureAccordion";
import { HeroGrid } from "@/components/marketing/HeroGrid";
import { Footer } from "@/components/marketing/Footer";
import { MarketingNav } from "@/components/marketing/MarketingNav";

/**
 * The public page.
 *
 * Written for the person who pays: whoever is running projects out of
 * WhatsApp and sending work to a client for sign-off. It sells one thing --
 * a record of what the client approved and when -- and everything else is
 * supporting cast.
 *
 * This is a trade product, not a horizontal one: architects, civil and
 * structural engineers, contractors, interior designers -- the people who
 * design and build. Saying so is the point. What the visible copy must not do
 * is say it as a list of job titles, because a list is an exclusion list: it
 * cannot be finished, and everyone left off it -- the landscape architect,
 * the MEP consultant, the visualiser, the fitout firm -- reads it and leaves.
 *
 * So the sector is named by what it does. "Designs and builds" is every one
 * of those trades and no client alive, which is the other thing the line has
 * to do: this page must never read as something to forward to a client.
 *
 * It must also not shrink the product to its most quotable feature. Approval
 * is the sharp end, but a project here carries its drawings, its materials
 * and its payment milestones, and an eyebrow that says "for sending drawings"
 * sells a quarter of what was built. The professions survive in the meta
 * description below, where they are keyword coverage for search and nobody
 * reads them and feels left out.
 *
 * No invented testimonials, no borrowed client logos, no statistics we cannot
 * stand behind. This audience notices.
 */

export const metadata: Metadata = {
  title: "Drafo — the drawing your client approved, on the record",
  description:
    "Run a project with your client in one private place: drawings and "
    + "revisions, timestamped approvals, materials and payment milestones. "
    + "Built for architects, civil and structural engineers, contractors and "
    + "interior designers. Your client needs no account.",
};

export default function Home() {
  return (
    <>
      <MarketingNav />
      <main>
        <Hero />
        <Problem />
        <How />
        <Features />
        <ClientSide />
      </main>
      <Footer />
    </>
  );
}

/* ------------------------------------------------------------------ hero */

function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-rule">
      {/* Drafting-paper grid, which lights up green under the cursor. An
          architectural texture rather than a gradient, and faint enough to
          read as paper rather than decoration until it is touched. Its own
          component because it is the one interactive thing on an otherwise
          static page, and this file exports `metadata` -- it has to stay a
          server component. */}
      <HeroGrid />

      <div className="relative mx-auto max-w-shell px-4 py-16 sm:px-8 sm:py-24">
        <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.15fr] lg:gap-6">
          <div className="animate-rise">
            <p className="eyebrow">
              For everyone who designs and builds
            </p>

            <h1 className="mt-5 font-display text-[2.5rem] leading-[1.08] tracking-tight sm:text-[3.25rem]">
              The drawing your client approved, on the record.
            </h1>

            <p className="mt-6 max-w-[52ch] text-[1.0625rem] leading-relaxed text-muted">
              A private page you share with one client, for one project — the
              drawings, the materials, the payment milestones. They open a
              link, see the current drawing, and tap Approve — and the record
              cannot be edited, by them, by you, or by us.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link href="/register" className="btn-primary">
                Create an account
              </Link>
              <Link href="/login" className="btn-quiet">
                Sign in
              </Link>
            </div>

          </div>

          {/* The whole product in one drawing: drawings, materials, payment
              milestones and client access all hanging off a single project.
              The PNG has no background of its own, so the drafting grid runs
              underneath it rather than being boxed out.

              It also carries about a tenth of its width as transparent margin
              on each side, which left the diagram too small to read its own
              labels. The scale eats that margin rather than cropping the
              asset; the spill is transparent, and the section clips it. */}
          <div className="animate-rise lg:-mr-10 lg:w-[calc(100%_+_2.5rem)]">
            <Image
              src="/heroimageone.png"
              alt={
                "One project in Drafo, with drawings, materials, payment "
                + "milestones and client access branching off it."
              }
              width={1536}
              height={1024}
              priority
              sizes="(min-width: 1024px) 46rem, (min-width: 640px) 90vw, 100vw"
              draggable={false}
              className="mx-auto h-auto w-full max-w-[34rem] scale-[1.16] select-none lg:max-w-none"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- problem */

/**
 * The four failures, each with the object it happens to.
 *
 * Boxed cards gave all four the same weight and walled them off from the page;
 * an icon and open space let the eye land on one and read only that. The
 * glyphs are the thing that goes wrong -- a voice note, a pile of files, a
 * calendar -- not decoration chosen to fill a corner.
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

function Problem() {
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
              {/* 28px at 1.75, not lucide's 24px at 2. The palette greens are
                  desaturated, so these cannot carry a section on colour the way
                  a high-chroma accent would -- they need the size instead. */}
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

/* ------------------------------------------------------------------- how */

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

/**
 * The one section that is not on paper.
 *
 * Four text sections in a row read as an article rather than a page, and this
 * is the one a visitor has to understand -- so it gets the only inversion on
 * the page. Everything here is a palette colour used as given: paper and sand
 * on brandDark clear AA at 7.3:1 and 6.1:1, and the step numerals clear the
 * 3:1 large-text floor at 3.7:1.
 */
function How() {
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
              {/* A numeral against a rule that runs out to the column edge:
                  the same measure mark the drawings themselves carry, and it
                  ties the three steps into one line across the band. */}
              <div className="flex items-center gap-5">
                <span
                  aria-hidden
                  className="font-display text-[2.75rem] leading-none tabular-nums text-sage"
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span aria-hidden className="h-px flex-1 bg-paper/25" />
              </div>

              {/* Two lines reserved once the steps sit side by side: the third
                  title wraps and the other two do not, which would otherwise
                  start one body a line below its neighbours. */}
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

/* -------------------------------------------------------------- features */

function Features() {
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

/* ---------------------------------------------------------------- client */

/**
 * Five promises, each one a thing the client never has to do.
 *
 * One glyph each rather than five identical ticks: once every row carried the
 * same mark it stopped carrying any information, and a row is easier to find
 * again by the thing it shows than by its position. Holding them all in accent
 * keeps them reading as one set of guarantees.
 */
const CLIENT_PROMISES = [
  [UserX, "No account", "Nothing to create, nothing to remember."],
  [Globe, "No app", "It opens in whatever browser they already have."],
  [
    MousePointerClick,
    "One tap to approve",
    "They type their name once, on their first approval only.",
  ],
  [
    Stamp,
    "Your name at the top",
    "Your practice name and logo. It reads as your tool, not ours.",
  ],
  [
    EyeOff,
    "Private and unlisted",
    "Not indexed by search engines, and the link never leaks in a referrer.",
  ],
] as const;

function ClientSide() {
  return (
    <section id="client" className="scroll-mt-20 border-b border-rule">
      <div className="mx-auto max-w-shell px-4 py-16 sm:px-8 sm:py-24">
        <p className="eyebrow">For your client</p>

        {/* The claim on the left, the argument for it on the right. Stacking
            them would leave the heading alone against half a screen of empty
            page; setting them side by side lets both hold their own measure
            and gives the section a top edge that reads as deliberate. */}
        <div className="mt-4 grid gap-x-12 gap-y-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] lg:items-start">
          {/* No max-measure here on purpose: the column is the measure, so the
              heading reaches its own edge instead of stopping short of it. */}
          <h2 className="font-display text-display">
            They install nothing and sign up for nothing
          </h2>

          {/* Only the reason why, and the turn. The sentences that used to
              follow -- no password, no OTP, no app, a link that simply opens
              -- are the list below said twice, and the list says them better,
              one to a line with a mark against each. */}
          <div className="lg:pt-1">
            <p className="max-w-reading text-[1.0625rem] leading-relaxed text-muted">
              Your client is often in their fifties, sometimes abroad, and has
              no interest in learning software. The moment a tool asks them to
              create an account, they say “just send it on WhatsApp”.
              So Drafo never asks.
            </p>
          </div>
        </div>

        {/* Two thirds list, one third door.
            Six equal cells made every promise weigh the same as the call to
            action and left the short ones trailing empty space to the bottom
            of their row. A ruled list carries five items without caring that
            five is an awkward number, and the panel beside it takes whatever
            height the list ends up at, so nothing has to be padded out. */}
        <div className="mt-14 grid gap-10 lg:grid-cols-[2fr_1fr] lg:gap-12">
          <ul className="self-start border-b border-rule">
            {CLIENT_PROMISES.map(([Icon, title, body]) => (
              <li
                key={title}
                className="flex gap-5 border-t border-rule py-6"
              >
                <Icon
                  aria-hidden
                  strokeWidth={1.75}
                  className="mt-0.5 h-6 w-6 shrink-0 text-brand"
                />
                <div>
                  <h3 className="font-display text-[1.25rem] leading-snug">
                    {title}
                  </h3>
                  <p className="mt-1.5 max-w-[52ch] text-[0.9375rem] leading-relaxed text-muted">
                    {body}
                  </p>
                </div>
              </li>
            ))}
          </ul>

          {/* The one place on this page asking for something, so it is the one
              block that is not on paper. A real button rather than the text
              link that was here: this is the section's whole purpose and it
              was the quietest thing in it. Paper on brandDark is 7.3:1. */}
          {/* The inset is set per part rather than once on the card: the
              picture wants to sit close to the edge, and the words do not. One
              padding for both meant the image could only come in as far as the
              text was comfortable. */}
          <div className="flex flex-col bg-brandDark text-paper">
            {/* Decorative, so the alt is empty: it is a mood, not information,
                and naming it would only add noise to a screen reader. The file
                carries its own rounded corners as transparency, so the card
                shows through them and no radius is set here. */}
            {/* Once the two columns sit side by side the picture takes
                whatever height is left after the words, so the card ends level
                with the list instead of hanging below it -- and stays level if
                either side's copy changes. Stacked, there is nothing to match,
                so it goes back to its own proportions.

                The file's baked-in corner radius works out to about 3px at
                this size, which object-cover crops away; `rounded` puts back
                the same barely-there softness. */}
            <div className="p-3 sm:p-4 lg:flex-1">
              <div className="relative aspect-[3896/3160] w-full overflow-hidden rounded lg:aspect-auto lg:h-full">
                <Image
                  src="/grass.png"
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 22rem, (min-width: 640px) 45vw, 90vw"
                  className="object-cover"
                />
              </div>
            </div>

            <div className="flex flex-col px-6 pb-6 pt-5 sm:px-8 sm:pb-8">
              <h3 className="font-display text-[1.5rem] leading-snug">
                The only way to know
              </h3>
              <p className="mt-3 text-[0.9375rem] leading-relaxed text-sand">
                Send one real drawing to one real client and watch what they do
                with it. That is the whole test.
              </p>

              <Link
                href="/register"
                className="mt-6 inline-flex min-h-[44px] items-center justify-center
                           bg-paper px-5 py-3 text-[0.9375rem] text-brandDark
                           transition-colors duration-150 hover:bg-sand"
              >
                Create an account
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

