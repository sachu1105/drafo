import Image from "next/image";
import Link from "next/link";
import { HeroGrid } from "@/components/marketing/HeroGrid";

/**
 * The first screen: who it is for, what it does, and the way in.
 *
 * The grid behind it is its own component and not part of this one -- it is
 * the only interactive thing on the marketing page, and keeping it separate
 * is what lets everything here stay a server component.
 */
export function Hero() {
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
