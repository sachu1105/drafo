import type { NextConfig } from "next";

/**
 * Django is proxied under /api rather than called cross-origin.
 *
 * That buys three things for free: the session cookie is same-origin so login
 * just works, CSRF stops being a puzzle, and every file URL the API returns is
 * a plain path that the browser can use unchanged. The API never has to guess
 * at its own public hostname.
 */
const apiTarget =
  process.env.API_PROXY_TARGET ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:8000";

const nextConfig: NextConfig = {
  // Django's URLs all end in a slash. Without this, Next 308s /api/foo/ to
  // /api/foo before the rewrite runs, Django's APPEND_SLASH bounces it back,
  // and every POST from the browser dies in the middle.
  skipTrailingSlashRedirect: true,

  async rewrites() {
    return [
      // A (.*) capture rather than :path* -- the segment form drops the
      // trailing slash, and every Django URL has one.
      { source: "/api/:path(.*)", destination: `${apiTarget}/api/:path` },
      { source: "/django-admin/:path(.*)", destination: `${apiTarget}/django-admin/:path` },
      // The admin's own CSS and JS. Without this the admin renders as raw
      // unstyled HTML: Next owns /static and has nothing to serve there.
      // Next's own assets live under /_next/static, so there is no clash.
      { source: "/static/:path(.*)", destination: `${apiTarget}/static/:path` },
    ];
  },
  async headers() {
    return [
      {
        // The client's URL *is* their credential. It must never leak in a
        // Referer header to anything they tap through to.
        source: "/p/:path*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
        ],
      },
      {
        // A profile card is public, but it is handed to someone, not found by
        // searching for them. There is no discovery anywhere in this product,
        // and an architect who ticked "publish" did not thereby ask to be
        // indexed. Nothing here blocks a WhatsApp or iMessage unfurl.
        //
        // No no-referrer: unlike a client link the slug is not a credential,
        // and the card links out to the architect's own website.
        source: "/c/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;
