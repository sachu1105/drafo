"use client";

import { Printer } from "lucide-react";

/**
 * Save the invoice as a PDF.
 *
 * It calls window.print(), and that is the whole implementation. Every
 * browser's print dialog offers "Save as PDF" as a destination, and going
 * through it means the file the client keeps is the page they were looking
 * at, rendered by the same engine.
 *
 * The alternative -- a server-side renderer -- is a second implementation of
 * the same document, with its own fonts, its own layout engine and its own
 * bugs. Two renderings of one invoice is one more than a document should
 * have, and the day they disagree is the day a client is holding a PDF that
 * says something the page does not.
 */
export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="btn-quiet">
      <Printer aria-hidden size={16} strokeWidth={1.75} />
      Print or save as PDF
    </button>
  );
}
