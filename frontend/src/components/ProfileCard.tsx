import { Globe, Mail, MapPin, Phone } from "lucide-react";
import type { ProfileCard as Card } from "@/lib/types";

/**
 * The card.
 *
 * One component, two places: the live preview on the architect's own profile
 * screen, and the page anyone holding the link opens. They must not drift --
 * a preview that lies about what was shared is worse than no preview.
 *
 * The shape is the one everybody already knows from a profile: a cover band
 * across the top, the portrait punched through its bottom edge, the name
 * under that, and the ways of reaching them listed below. The band is always
 * drawn, photograph or not, so the layout never rearranges itself depending
 * on which pictures happen to have been filled in.
 */
export function ProfileCard({
  card,
  interactive = true,
}: {
  card: Card;
  /** The preview renders the same markup with its actions inert. */
  interactive?: boolean;
}) {
  const website = normaliseUrl(card.website);
  const rows = [
    card.phone && {
      icon: Phone,
      label: "Phone",
      value: card.phone,
      href: `tel:${card.phone.replace(/[^\d+]/g, "")}`,
    },
    card.email && {
      icon: Mail,
      label: "Email",
      value: card.email,
      href: `mailto:${card.email}`,
    },
    website && {
      icon: Globe,
      label: "Website",
      value: website.replace(/^https?:\/\//, "").replace(/\/$/, ""),
      href: website,
    },
    card.location && {
      icon: MapPin,
      label: "Location",
      value: card.location,
      href: null,
    },
  ].filter(Boolean) as Row[];

  return (
    <article className="overflow-hidden border border-rule bg-card">
      {/* --- the cover band ----------------------------------------------
          A fixed 3:1 ratio rather than a fixed height, so the same crop is
          framed identically on a phone and at a desk and nothing jumps as the
          image loads. With no photograph it stays a flat brand band, which
          reads as a letterhead rather than as a gap. */}
      <div className="relative aspect-[3/1] w-full bg-brand">
        {card.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={card.cover_url}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : null}

        {/* The logo rides on the band, on its own paper chip. Laid straight
            over a photograph it would be legible or not depending on what
            the photograph happened to contain. */}
        {card.logo_url ? (
          <div className="absolute right-3 top-3 border border-rule bg-paper/95 px-2.5 py-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={card.logo_url}
              alt={card.practice_name}
              className="h-5 w-auto max-w-[120px] object-contain object-right sm:h-6 sm:max-w-[140px]"
            />
          </div>
        ) : null}
      </div>

      {/* --- who they are ----------------------------------------------- */}
      <div className="px-6 pb-6 sm:px-8">
        <Portrait card={card} />

        <h1 className="mt-3 break-words font-display text-title">{card.name}</h1>
        {card.profession ? (
          <p className="mt-1 text-[0.9375rem] leading-snug text-muted">
            {card.profession}
          </p>
        ) : null}
        {card.practice_name && card.practice_name !== card.name ? (
          <p className="mt-0.5 text-[0.875rem] text-faint">{card.practice_name}</p>
        ) : null}

        {card.bio ? (
          <p className="mt-4 whitespace-pre-line text-[0.9375rem] leading-relaxed text-muted">
            {card.bio}
          </p>
        ) : null}
      </div>

      {/* --- how to reach them ------------------------------------------ */}
      {rows.length > 0 ? (
        <dl className="border-t border-ruleSoft">
          {rows.map((row) => (
            <DetailRow key={row.label} row={row} interactive={interactive} />
          ))}
        </dl>
      ) : null}
    </article>
  );
}

type Row = {
  icon: typeof Phone;
  label: string;
  value: string;
  href: string | null;
};

function DetailRow({ row, interactive }: { row: Row; interactive: boolean }) {
  const Icon = row.icon;
  const inner = (
    <>
      <Icon aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-faint" />
      <div className="min-w-0">
        <dt className="eyebrow">{row.label}</dt>
        <dd className="mt-0.5 break-words text-[0.9375rem]">{row.value}</dd>
      </div>
    </>
  );

  const shell =
    "flex items-start gap-3 border-b border-ruleSoft px-6 py-3.5 last:border-b-0 sm:px-8";

  if (!interactive || !row.href) {
    return <div className={shell}>{inner}</div>;
  }
  return (
    <a
      href={row.href}
      {...(row.href.startsWith("http")
        ? { target: "_blank", rel: "noopener noreferrer" }
        : {})}
      className={`${shell} transition-colors duration-150 hover:bg-paper`}
    >
      {inner}
    </a>
  );
}

/**
 * Their photo, or their initials -- punched through the bottom edge of the
 * band, with a border in the card's own colour so the overlap reads as
 * deliberate rather than as a collision.
 */
function Portrait({ card }: { card: Card }) {
  // `relative` is load-bearing: the band above is positioned, so without it
  // the portrait is painted underneath the band and only its bottom shows.
  const frame =
    "relative -mt-10 block h-[76px] w-[76px] border-4 border-card sm:-mt-11 sm:h-[84px] sm:w-[84px]";

  if (card.avatar_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={card.avatar_url}
        alt={card.name}
        className={`${frame} bg-sand object-cover`}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={`${frame} flex items-center justify-center bg-brandDark
                  font-display text-[1.375rem] tracking-wide text-paper`}
    >
      {initials(card.name)}
    </span>
  );
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "—";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/** A website typed as "studio.in" is still meant to be a link. */
export function normaliseUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}
