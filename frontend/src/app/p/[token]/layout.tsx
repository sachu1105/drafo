import type { Metadata } from "next";

/**
 * Everything under /p/<token> is unlisted, permanently.
 *
 * The URL is the credential, so it must not be indexed, must not appear in a
 * Referer header, and must not be archived. next.config.ts sends the matching
 * response headers; this covers the crawlers that read the document instead.
 */
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
  referrer: "no-referrer",
};

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
