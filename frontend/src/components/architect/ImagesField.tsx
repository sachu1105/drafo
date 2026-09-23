"use client";

import { useEffect, useId, useRef, useState } from "react";

/** A picture already on the server, as the API reports it. */
type Stored = { id: number; url: string };

/**
 * A picker for several pictures at once.
 *
 * The single-file FileField beside it shows a filename and a size, which is
 * the right answer for an invoice: nobody needs to look at a PDF to know it
 * is the right PDF. It is the wrong answer for photographs. Four rows reading
 * IMG_4471.HEIC through IMG_4474.HEIC say nothing about which one has the
 * edge detail in it, so these are thumbnails, and each can be dropped alone.
 *
 * Everything sits inside the one dashed frame -- the pictures already saved,
 * the ones about to be, and the prompt. They were stacked above it, which
 * made the empty control a different height from the file field beside it
 * and left two boxes that never lined up. Empty, this is now exactly
 * FileField's geometry, so the pair sit level.
 *
 * Adding is additive. Choosing files twice means both sets: the native
 * control replaces its selection every time it opens, and an architect who
 * picks three and then remembers a fourth should not lose the three.
 */
export function ImagesField({
  files,
  onFiles,
  existing = [],
  onRemoveExisting,
  accept,
  hint,
  max,
  disabled,
}: {
  files: File[];
  onFiles: (files: File[]) => void;
  /** Pictures already saved. Editing shows them; adding has none. */
  existing?: Stored[];
  onRemoveExisting?: (photo: Stored) => void;
  accept: string;
  hint: string;
  /** The total a material may carry, saved and pending together. */
  max: number;
  disabled?: boolean;
}) {
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const held = existing.length + files.length;
  const room = Math.max(0, max - held);
  const full = room === 0;

  function take(list: FileList | null) {
    if (!list || list.length === 0) return;
    onFiles([...files, ...Array.from(list)].slice(0, max - existing.length));
    // Without this, picking the same file twice in a row fires no change
    // event the second time and looks like the control is broken.
    if (input.current) input.current.value = "";
  }

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled && !full) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        if (!disabled && !full) take(event.dataTransfer.files);
      }}
      className={`border border-dashed transition-colors duration-150 ${
        dragging ? "border-brand bg-card" : "border-rule bg-paper"
      }`}
    >
      {held > 0 ? (
        // Outside the label on purpose: a thumbnail inside it would open the
        // file dialog, and the button on it could never be clicked.
        <ul className="flex flex-wrap gap-2 px-4 pt-4">
          {existing.map((photo) => (
            <Thumb
              key={`saved-${photo.id}`}
              url={photo.url}
              label="this picture"
              onRemove={
                onRemoveExisting ? () => onRemoveExisting(photo) : undefined
              }
            />
          ))}
          {files.map((file, index) => (
            <PendingThumb
              key={`new-${file.name}-${file.lastModified}-${index}`}
              file={file}
              onRemove={() => onFiles(files.filter((_, at) => at !== index))}
            />
          ))}
        </ul>
      ) : null}

      <label
        htmlFor={inputId}
        className={`flex flex-col items-center justify-center gap-1 px-4 py-7
                    text-center ${
                      full || disabled ? "cursor-not-allowed" : "cursor-pointer"
                    }`}
      >
        <span className="text-[0.875rem]">
          {full ? (
            <span className="text-muted">
              {existing.length
                ? "Remove one of these to add another"
                : `That is all ${max} of them`}
            </span>
          ) : (
            <>
              <span className="underline decoration-rule underline-offset-4">
                {held ? "Add more" : "Choose pictures"}
              </span>{" "}
              <span className="text-muted">or drag them here</span>
            </>
          )}
        </span>
        <span className="text-[0.75rem] text-faint">
          {held ? `${held} of ${max} — ${hint}` : hint}
        </span>
      </label>

      <input
        ref={input}
        id={inputId}
        type="file"
        accept={accept}
        multiple
        disabled={disabled || full}
        onChange={(event) => take(event.target.files)}
        className="sr-only"
      />
    </div>
  );
}

function Thumb({
  url,
  label,
  onRemove,
}: {
  url: string;
  label: string;
  onRemove?: () => void;
}) {
  return (
    <li className="relative">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" className="h-20 w-20 object-cover" />
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${label}`}
          className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center
                     rounded-full border border-rule bg-card text-[0.875rem] leading-none
                     text-muted transition-colors duration-150 hover:border-brand
                     hover:text-ink"
        >
          &times;
        </button>
      ) : null}
    </li>
  );
}

/**
 * A picture chosen but not yet sent.
 *
 * The object URL does not exist until an effect has run, so nothing is drawn
 * until it does. Rendering an <img src=""> in the meantime makes the browser
 * re-request the whole page, which Next warns about and is right to.
 */
function PendingThumb({ file, onRemove }: { file: File; onRemove: () => void }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const made = URL.createObjectURL(file);
    setUrl(made);
    return () => URL.revokeObjectURL(made);
  }, [file]);

  if (!url) {
    return <li aria-hidden className="h-20 w-20 bg-sand" />;
  }

  return <Thumb url={url} label={file.name} onRemove={onRemove} />;
}
