import Link from "next/link";

/**
 * The frame around the two auth pages.
 *
 * Both were dead ends. The wordmark on the sign-in page was a plain heading
 * and neither page carried a single link back to the public site, so anyone
 * who followed "Sign in" out of curiosity had nothing but the browser's back
 * button -- and on a phone, where that gesture is easy to miss, nothing at
 * all. The bar is the one the signed-in app already uses, so crossing into
 * the auth pages does not feel like arriving at a different product.
 *
 * The wordmark is the way back. It is where people reach for it, and a second
 * labelled link beside it said the same thing twice.
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-rule">
        <div className="mx-auto flex w-full max-w-shell items-center px-4 py-3.5 sm:px-8">
          <Link
            href="/"
            className="flex min-h-[44px] items-center font-display text-[1.375rem]
                       leading-none tracking-tight transition-opacity duration-150
                       hover:opacity-70"
          >
            Atelier
          </Link>
        </div>
      </header>

      {/* flex-1 rather than min-h-screen: the form stays optically centred in
          what is left of the viewport instead of being pushed a header's
          height below centre. */}
      <main className="mx-auto flex w-full max-w-reading flex-1 flex-col justify-center px-6 py-16">
        {children}
      </main>
    </div>
  );
}
