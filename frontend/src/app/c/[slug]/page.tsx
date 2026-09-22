import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProfileCard } from "@/components/ProfileCard";
import { fetchClientData } from "@/lib/api";
import type { ProfileCard as Card } from "@/lib/types";

/**
 * The profile card.
 *
 * The one page in this product that anyone is allowed to open, and the only
 * one with no token in its URL. It exists because a link is a better business
 * card than a business card: it cannot be lost, and it drops straight into the
 * phone's contacts.
 *
 * Rendered on the server: it is opened from a WhatsApp message on a phone, so
 * it has to arrive finished.
 */

export const dynamic = "force-dynamic";

async function load(slug: string): Promise<Card | null> {
  return fetchClientData<Card>(`/api/card/${slug}/`);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const card = await load(slug);
  if (!card) return { title: "Card not available", robots: { index: false } };

  const subtitle = [card.profession, card.practice_name]
    .filter(Boolean)
    .filter((part, index, all) => all.indexOf(part) === index)
    .join(" · ");

  return {
    title: `${card.name}${subtitle ? ` · ${subtitle}` : ""}`,
    description: card.bio || subtitle || undefined,
    // Shared by hand, into WhatsApp, and that preview is the first thing the
    // recipient sees.
    openGraph: {
      type: "profile",
      title: card.name,
      description: card.bio || subtitle || undefined,
      images: card.avatar_url ? [{ url: card.avatar_url }] : undefined,
    },
  };
}

export default async function CardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const card = await load(slug);
  if (!card) notFound();

  const digits = card.phone.replace(/\D/g, "");

  return (
    <div className="flex min-h-screen flex-col">
      <main className="mx-auto w-full max-w-[30rem] flex-1 px-4 py-10 sm:py-16">
        <div className="animate-rise">
          <ProfileCard card={card} />

          {/* --- the point of the page: get off it and into a contact ---
              One thing to do, stated once, with the quicker ways of getting
              hold of them underneath it. Five equal buttons is not a choice,
              it is a menu, and a card should not need reading.

              There is no "visit website" button: the website is a row on the
              card already, and tapping it opens it. */}
          <div className="mt-4">
            <a
              href={`/api/card/${card.card_slug}/vcard/`}
              className="btn-primary w-full"
              download
            >
              Save to contacts
            </a>

            <div className="mt-2 grid grid-cols-2 gap-2">
              {digits ? (
                <a
                  href={`https://wa.me/${digits}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-quiet"
                >
                  WhatsApp
                </a>
              ) : null}
              {card.phone ? (
                <a
                  href={`tel:${card.phone.replace(/[^\d+]/g, "")}`}
                  className="btn-quiet"
                >
                  Call
                </a>
              ) : null}
              <a
                href={`mailto:${card.email}`}
                className={`btn-quiet ${card.phone ? "col-span-2" : ""}`}
              >
                Email
              </a>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
