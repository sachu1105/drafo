/**
 * A wrong token and a deleted project look identical from here, on purpose.
 * Nothing on this page confirms that anything exists.
 */
export default function LinkNotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-reading flex-col justify-center px-6 py-20">
      <h1 className="font-display text-title">This link is not available</h1>
      <p className="mt-4 text-[0.9375rem] leading-relaxed text-muted">
        It may have been replaced with a newer one, or it may have been typed or
        copied incompletely.
      </p>
      <p className="mt-3 text-[0.9375rem] leading-relaxed text-muted">
        Ask your architect to send the link again.
      </p>
    </main>
  );
}
