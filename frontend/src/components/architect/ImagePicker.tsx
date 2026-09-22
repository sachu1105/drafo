"use client";

import { useEffect, useId, useRef, useState } from "react";

/**
 * Pick a picture and see it immediately.
 *
 * The native control says "Browse… No file selected" and shows nothing until
 * the form has been saved and reloaded, which is how someone ends up
 * uploading the same logo three times. This shows the chosen file straight
 * away, in the shape it will actually be drawn in.
 *
 * `shape` is cosmetic only -- nothing is cropped, either here or on the
 * server. A picture that looked right in the preview is the picture that gets
 * stored.
 */
export function ImagePicker({
  label,
  hint,
  currentUrl,
  file,
  removed,
  onFile,
  onRemove,
  accept,
  shape = "square",
  maxBytes,
  error,
}: {
  label: string;
  hint: string;
  /** What is stored now, or null if nothing is. */
  currentUrl: string | null;
  /** What has been picked but not yet saved. */
  file: File | null;
  /** Whether the stored picture is queued for removal. */
  removed: boolean;
  onFile: (file: File | null) => void;
  onRemove: () => void;
  accept: string;
  shape?: "square" | "wide" | "banner";
  /** Refuse a file this big here, rather than after a failed save. */
  maxBytes?: number;
  /** The server's complaint about this picture, if it made one. */
  error?: string;
}) {
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [tooBig, setTooBig] = useState<string | null>(null);

  // A blob URL is a live handle on the file; letting them accumulate while
  // someone tries four logos leaks all four.
  useEffect(() => {
    if (!file) {
      setPicked(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPicked(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const shown = picked ?? (removed ? null : currentUrl);
  const hasStored = Boolean(currentUrl) && !removed;

  function clear() {
    onFile(null);
    setTooBig(null);
    if (input.current) input.current.value = "";
  }

  /**
   * Check the size here as well as on the server.
   *
   * The server is the gate; this is so that picking a 9 MB photo says so at
   * once instead of after a form has been filled in and submitted.
   */
  function take(chosen: File | null) {
    if (chosen && maxBytes && chosen.size > maxBytes) {
      setTooBig(
        `That file is ${(chosen.size / 1048576).toFixed(1)} MB and the limit ` +
          `is ${Math.round(maxBytes / 1048576)} MB. Try a smaller one.`,
      );
      onFile(null);
      if (input.current) input.current.value = "";
      return;
    }
    setTooBig(null);
    onFile(chosen);
  }

  return (
    <div>
      <span className="eyebrow block">{label}</span>
      <span className="mt-1 block text-[0.8125rem] leading-relaxed text-faint">
        {hint}
      </span>

      <div className="mt-3 flex items-center gap-4">
        <div
          className={`flex shrink-0 items-center justify-center overflow-hidden
                      border bg-paper ${
                        error || tooBig ? "border-ink" : "border-rule"
                      } ${
                        shape === "square"
                          ? "h-20 w-20"
                          : shape === "banner"
                            ? "aspect-[3/1] h-auto w-40"
                            : "h-20 w-[9.5rem] px-2"
                      }`}
        >
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={shown}
              alt=""
              className={
                shape === "wide"
                  ? "max-h-16 w-auto max-w-full object-contain"
                  : "h-full w-full object-cover"
              }
            />
          ) : (
            <span className="px-2 text-center text-[0.75rem] leading-tight text-faint">
              Nothing yet
            </span>
          )}
        </div>

        <div className="min-w-0">
          {/* Both of these are thumbed on a phone, so both clear 44px. */}
          <div className="flex flex-wrap items-center gap-x-4">
            <label
              htmlFor={inputId}
              className="inline-flex min-h-[44px] cursor-pointer items-center
                         text-[0.875rem] underline decoration-rule
                         underline-offset-4 hover:text-ink"
            >
              {shown ? "Choose another" : "Choose a file"}
            </label>

            {file ? (
              <button
                type="button"
                onClick={clear}
                className="inline-flex min-h-[44px] items-center text-[0.875rem]
                           text-muted hover:text-ink"
              >
                Undo
              </button>
            ) : hasStored ? (
              <button
                type="button"
                onClick={onRemove}
                className="inline-flex min-h-[44px] items-center text-[0.875rem]
                           text-muted hover:text-ink"
              >
                Remove
              </button>
            ) : null}
          </div>

          <p className="-mt-1 truncate text-[0.8125rem] text-faint">
            {file
              ? file.name
              : removed && currentUrl
                ? "Will be removed when you save"
                : hasStored
                  ? "Saved"
                  : ""}
          </p>
        </div>
      </div>

      {tooBig ?? error ? (
        <p role="alert" className="mt-2 text-[0.8125rem] text-ink">
          {tooBig ?? error}
        </p>
      ) : null}

      <input
        ref={input}
        id={inputId}
        type="file"
        accept={accept}
        onChange={(event) => take(event.target.files?.[0] ?? null)}
        className="sr-only"
      />
    </div>
  );
}
