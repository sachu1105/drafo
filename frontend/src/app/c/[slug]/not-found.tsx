/**
 * A card that was never created, one that was switched off and one whose
 * owner's account was suspended all land here, saying the same thing. None of
 * them is anyone's business.
 */
export default function CardNotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-reading flex-col justify-center px-6 py-20">
      <h1 className="font-display text-title">This card is not available</h1>
      <p className="mt-4 text-[0.9375rem] leading-relaxed text-muted">
        It may have been switched off, or the link may have been typed or copied
        incompletely.
      </p>
    </main>
  );
}
