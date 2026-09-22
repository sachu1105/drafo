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

export function Footer() {
  return (
    <footer className="border-t border-rule">
      <div className="mx-auto max-w-shell px-4 py-14 sm:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="font-display text-[1.375rem] leading-none tracking-tight">
              Atelier
            </p>
            <p className="mt-3 max-w-[26ch] text-[0.8125rem] leading-relaxed text-muted">
              A private portal between a practice and one client, for one
              project.
            </p>
          </div>

          {COLUMNS.map((column) => (
            <div key={column.heading}>
              <h2 className="eyebrow">{column.heading}</h2>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.label + link.href}>
                    <Link
                      href={link.href}
                      className="text-[0.875rem] text-muted transition-colors
                                 duration-150 hover:text-ink"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-wrap items-center justify-between gap-3 border-t border-ruleSoft pt-6">
          <p className="text-[0.8125rem] text-faint">
            © {new Date().getFullYear()} Atelier
          </p>
          <p className="text-[0.8125rem] text-faint">
            Your client never needs an account.
          </p>
        </div>
      </div>
    </footer>
  );
}
