import Image from "next/image";
import Link from "next/link";
import {
  EyeOff,
  Globe,
  MousePointerClick,
  Stamp,
  UserX,
} from "lucide-react";

/**
 * The client's side of the deal, which is the objection every visitor has.
 *
 * An architect does not fear the software; they fear having to talk their
 * client into it. So this section is not a feature list -- it is five
 * promises about what the client is never asked to do, and the product is
 * built so that all five stay true.
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

export function ClientSide() {
  return (
    <section id="client" className="scroll-mt-20 border-b border-rule">
      <div className="mx-auto max-w-shell px-4 py-16 sm:px-8 sm:py-24">
        <p className="eyebrow">For your client</p>

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
              So Drafo never asks.
            </p>
          </div>
        </div>

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

  
          <div className="flex flex-col bg-brandDark text-paper">
     
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
