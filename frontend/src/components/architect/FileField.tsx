"use client";

import { useId, useRef, useState } from "react";
import { formatSize } from "@/lib/format";

/**
 * A file picker that does not look like 1998.
 *
 * The native control renders as "Browse… No file selected" and differs on
 * every OS, so it is kept for keyboard and screen-reader users and hidden
 * visually. What is drawn instead states the accepted types and the size
 * limit up front, takes a drop, and shows the chosen file with a way to
 * change its mind.
 */
export function FileField({
  file,
  onFile,
  accept,
  hint,
  disabled,
}: {
  file: File | null;
  onFile: (file: File | null) => void;
  accept: string;
  hint: string;
  disabled?: boolean;
}) {
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function take(list: FileList | null) {
    onFile(list && list.length > 0 ? list[0] : null);
  }

  if (file) {
    return (
      <div className="flex items-center gap-3 border border-rule bg-paper px-4 py-3">
        <DocumentIcon />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.875rem]">{file.name}</p>
          <p className="text-[0.75rem] text-faint">{formatSize(file.size)}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            onFile(null);
            if (input.current) input.current.value = "";
          }}
          className="shrink-0 text-[0.8125rem] text-muted hover:text-ink"
        >
          Change
        </button>
        <input
          ref={input}
          id={inputId}
          type="file"
          accept={accept}
          onChange={(event) => take(event.target.files)}
          className="sr-only"
        />
      </div>
    );
  }

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        if (!disabled) take(event.dataTransfer.files);
      }}
      className={`border border-dashed transition-colors duration-150 ${
        dragging ? "border-brand bg-card" : "border-rule bg-paper"
      }`}
    >
      <label
        htmlFor={inputId}
        className="flex cursor-pointer flex-col items-center justify-center
                   gap-1 px-4 py-7 text-center"
      >
        <span className="text-[0.875rem]">
          <span className="underline decoration-rule underline-offset-4">
            Choose a file
          </span>{" "}
          <span className="text-muted">or drag it here</span>
        </span>
        <span className="text-[0.75rem] text-faint">{hint}</span>
      </label>
      <input
        ref={input}
        id={inputId}
        type="file"
        accept={accept}
        disabled={disabled}
        onChange={(event) => take(event.target.files)}
        className="sr-only"
      />
    </div>
  );
}

function DocumentIcon() {
  return (
    <svg aria-hidden viewBox="0 0 20 20" className="h-5 w-5 shrink-0 text-faint">
      <path
        d="M11.5 2.5H6a1.5 1.5 0 0 0-1.5 1.5v12A1.5 1.5 0 0 0 6 17.5h8a1.5 1.5 0 0 0 1.5-1.5V6.5l-4-4Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path
        d="M11.5 2.5v4h4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}
