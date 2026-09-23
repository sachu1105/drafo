import type { Metadata, Viewport } from "next";
import { DM_Sans, Space_Grotesk } from "next/font/google";
import { THEME_SCRIPT } from "@/components/ThemeToggle";
import "@/styles/globals.css";

// Two families, no more. Space Grotesk is geometric and slightly technical --
// it reads as drawing-office rather than as a brochure. Only 500 and 700 are
// loaded, so a stray font-weight: 400 still resolves to 500 and headings can
// never render thin.
const display = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-display",
  display: "swap",
});

const body = DM_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Drafo",
  description:
    "One private place to run a project with your client: drawings, "
    + "materials and payments.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // The colour behind the browser's own chrome on a phone. Two entries, or
  // the address bar stays cream above a black page.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F4F3E6" },
    { media: "(prefers-color-scheme: dark)", color: "#141917" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    /* suppressHydrationWarning because the script below writes data-theme onto
       this element before React sees it, so the server's markup and the
       client's disagree by exactly that one attribute -- on purpose. */
    <html
      lang="en"
      data-theme="light"
      suppressHydrationWarning
      className={`${display.variable} ${body.variable}`}
    >
      <head>
        {/* Before the first paint, not after. The alternative is a cream page
            repainted black a moment later, which is the most noticeable bug a
            dark theme can have. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
