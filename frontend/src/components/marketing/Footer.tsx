import Link from "next/link";

const COLUMNS: { heading: string; links: { label: string; href: string }[] }[] = [
  {
    heading: "Product",
    links: [
      { label: "Why Atelier", href: "/#problem" },
      { label: "How it works", href: "/#how" },
      { label: "Features", href: "/#features" },
      { label: "For your client", href: "/#client" },
    ],
  },
  {
    heading: "Who it is for",
    links: [
      { label: "Architects", href: "/#features" },
      { label: "Civil engineers", href: "/#features" },
      { label: "Interior designers", href: "/#features" },
      { label: "Small practices", href: "/#features" },
    ],
  },
  {
    heading: "Account",
    links: [
      { label: "Sign in", href: "/login" },
      { label: "Request an account", href: "/register" },
    ],
  },
];

/**
 * The page ends on the brand rather than trailing off.
 *
 * Six sections of near-white in a row left the foot of the page looking
 * bleached, and the last thing a visitor sees was the faintest thing on it.
 * This closes the page against the same brandDark the How band opens with, so
 * the two dark blocks bracket the light ones between them.
 *
 * Only two of the palette greens survive on this ground: paper at 7.3:1 and
 * sand at 6.1:1. Sage lands at 3.7 and olive at 2.3, so neither can carry
 * text here however quiet the line is meant to be -- the dimmest usable step
 * is sand held at 85%, which is 4.9:1 and still clears AA.
 */
export function Footer() {
  return (
    <footer className="bg-brandDark text-paper">
      <div className="mx-auto max-w-shell px-4 py-14 sm:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="font-display text-[1.375rem] leading-none tracking-tight">
              Atelier
            </p>
            <p className="mt-3 max-w-[26ch] text-[0.8125rem] leading-relaxed text-sand">
              A private portal between a practice and one client, for one
              project.
            </p>
          </div>

          {COLUMNS.map((column) => (
            <div key={column.heading}>
              <h2 className="eyebrow text-sand">{column.heading}</h2>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.label + link.href}>
                    <Link
                      href={link.href}
                      className="text-[0.875rem] text-sand transition-colors
                                 duration-150 hover:text-paper"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-wrap items-center justify-between gap-3 border-t border-paper/20 pt-6">
          <p className="text-[0.8125rem] text-sand/85">
            © {new Date().getFullYear()} Atelier
          </p>
          <p className="text-[0.8125rem] text-sand/85">
            Your client never needs an account.
          </p>
        </div>
      </div>
    </footer>
  );
}
