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
import { Footer } from "@/components/marketing/Footer";
import { MarketingNav } from "@/components/marketing/MarketingNav";

/**
 * The public page.
 *
 * Written for the person who pays: an architect, engineer or interior designer
 * running projects out of WhatsApp. It sells one thing -- a record of what the
 * client approved and when -- and everything else is supporting cast.
 *
 * No invented testimonials, no borrowed client logos, no statistics we cannot
 * stand behind. This audience notices.
 */

export const metadata: Metadata = {
  title: "Atelier — the drawing your client approved, on the record",
  description:
    "A private project portal for architects, engineers and interior designers. "
    + "Share drawings, capture timestamped approvals, and keep materials and "
    + "payment milestones in one place. Your client needs no account.",
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
        <Closing />
      </main>
      <Footer />
    </>
  );
}

/* ------------------------------------------------------------------ hero */

function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-rule">
      {/* Drafting-paper grid. An architectural texture rather than a gradient,
          and faint enough to read as paper rather than decoration. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.55]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #CBD1C0 1px, transparent 1px)," +
            "linear-gradient(to bottom, #CBD1C0 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage: "radial-gradient(120% 90% at 50% 0%, #000 30%, transparent 75%)",
          WebkitMaskImage:
            "radial-gradient(120% 90% at 50% 0%, #000 30%, transparent 75%)",
        }}
      />

      <div className="relative mx-auto max-w-shell px-4 py-16 sm:px-8 sm:py-24">
        <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.15fr] lg:gap-6">
          <div className="animate-rise">
            <p className="eyebrow">
              For architects, engineers and interior designers
            </p>

            <h1 className="mt-5 font-display text-[2.5rem] leading-[1.08] tracking-tight sm:text-[3.25rem]">
              The drawing your client approved, on the record.
            </h1>

            <p className="mt-6 max-w-[52ch] text-[1.0625rem] leading-relaxed text-muted">
              A private page you share with one client, for one project. They
              open a link, see the current drawing, and tap Approve — and the
              record cannot be edited, by them, by you, or by us.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link href="/register" className="btn-primary">
                Request an account
              </Link>
              <Link href="/login" className="btn-quiet">
                Sign in
              </Link>
            </div>

            <p className="mt-5 text-[0.875rem] text-faint">
              No app to install. Your client creates no account, ever.
            </p>
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
              src="/heroimages.png"
              alt={
                "One project in Atelier, with drawings, materials, payment "
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
          Atelier fixes exactly these four things. It deliberately does nothing
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

          <div className="lg:pt-1">
            <p className="max-w-reading text-[1.0625rem] leading-relaxed text-muted">
              Your client is often in their fifties, sometimes abroad, and has
              no interest in learning software. The moment a tool asks them to
              create an account, they say “just send it on WhatsApp”.
            </p>
            <p className="mt-4 max-w-reading text-[1.0625rem] leading-relaxed text-muted">
              So Atelier never asks. There is no client password, no OTP, no
              app. There is a long private link, and it simply opens.
            </p>
          </div>
        </div>

        {/* Five promises and a way in. Six cells divide evenly at both two and
            three columns, so the grid never ends on a half-empty row -- and
            the cell that would otherwise be the gap does the most work. */}
        <ul className="mt-14 grid gap-px border border-rule bg-rule sm:grid-cols-2 lg:grid-cols-3">
          {CLIENT_PROMISES.map(([Icon, title, body]) => (
            <li key={title} className="bg-card p-6 sm:p-7">
              <div className="flex h-6 items-center">
                <Icon
                  aria-hidden
                  strokeWidth={1.75}
                  className="h-6 w-6 text-accent"
                />
              </div>
              <h3 className="mt-3.5 font-display text-[1.25rem] leading-snug">
                {title}
              </h3>
              <p className="mt-2 text-[0.9375rem] leading-relaxed text-muted">
                {body}
              </p>
            </li>
          ))}

          {/* Sand, not card: the one cell here that is a door rather than a
              statement. Body copy goes to ink because muted on sand lands at
              4.5:1, which is too close to the line to rely on. */}
          <li className="flex flex-col justify-between bg-sand p-6 sm:p-7">
            <div>
              <div aria-hidden className="flex h-6 items-center" />
              <h3 className="mt-3.5 font-display text-[1.25rem] leading-snug">
                The only way to know
              </h3>
              <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink">
                Send one real drawing to one real client and watch what they
                do with it. That is the whole test.
              </p>
            </div>

            <Link
              href="/register"
              className="group mt-6 inline-flex items-center gap-2 text-[0.9375rem] text-accent underline decoration-olive underline-offset-4 hover:decoration-accent"
            >
              Request an account
              <span
                aria-hidden
                className="transition-transform group-hover:translate-x-0.5"
              >
                →
              </span>
            </Link>
          </li>
        </ul>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- closing */

function Closing() {
  return (
    <section>
      <div className="mx-auto max-w-shell px-4 py-20 sm:px-8 sm:py-28">
        <div className="flex flex-wrap items-center justify-between gap-8">
          <div>
            <h2 className="max-w-[18ch] font-display text-display">
              Put your next revision on the record
            </h2>
            <p className="mt-4 max-w-reading text-[0.9375rem] leading-relaxed text-muted">
              Accounts are approved by hand while we are working with our first
              practices, so tell us who you are and we will get you set up.
            </p>
          </div>
          <Link href="/register" className="btn-primary">
            Request an account
          </Link>
        </div>
      </div>
    </section>
  );
}
